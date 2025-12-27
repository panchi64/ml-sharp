"""Minimal HTTP server for SHARP frontend integration.

For licensing see accompanying LICENSE file.
Copyright (C) 2025 Apple Inc. All Rights Reserved.
"""

from __future__ import annotations

import json
import logging
import tempfile
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from typing import Any

import click
import torch
import torch.nn.functional as F

from sharp.models import PredictorParams, RGBGaussianPredictor, create_predictor
from sharp.utils import io
from sharp.utils import logging as logging_utils
from sharp.utils.gaussians import Gaussians3D, save_ply, unproject_gaussians

LOGGER = logging.getLogger(__name__)

DEFAULT_MODEL_URL = "https://ml-site.cdn-apple.com/models/sharp/sharp_2572gikvuh.pt"

# Global predictor cache
_predictor: RGBGaussianPredictor | None = None
_device: torch.device | None = None


def get_predictor() -> tuple[RGBGaussianPredictor, torch.device]:
    """Get or create the cached predictor."""
    global _predictor, _device

    if _predictor is not None and _device is not None:
        return _predictor, _device

    # Determine device
    if torch.cuda.is_available():
        _device = torch.device("cuda")
    elif torch.mps.is_available():
        _device = torch.device("mps")
    else:
        _device = torch.device("cpu")

    LOGGER.info("Using device: %s", _device)
    LOGGER.info("Downloading model from %s", DEFAULT_MODEL_URL)

    state_dict = torch.hub.load_state_dict_from_url(DEFAULT_MODEL_URL, progress=True)

    _predictor = create_predictor(PredictorParams())
    _predictor.load_state_dict(state_dict)
    _predictor.eval()
    _predictor.to(_device)

    LOGGER.info("Model loaded successfully")
    return _predictor, _device


@torch.no_grad()
def predict_image(image_path: Path, output_ply_path: Path) -> int:
    """Run prediction on an image file and save to PLY.

    Returns the number of gaussians generated.
    """
    predictor, device = get_predictor()

    internal_shape = (1536, 1536)

    # Load image
    image, _, f_px = io.load_rgb(image_path)
    height, width = image.shape[:2]

    # Preprocess
    image_pt = torch.from_numpy(image.copy()).float().to(device).permute(2, 0, 1) / 255.0
    disparity_factor = torch.tensor([f_px / width]).float().to(device)

    image_resized_pt = F.interpolate(
        image_pt[None],
        size=(internal_shape[1], internal_shape[0]),
        mode="bilinear",
        align_corners=True,
    )

    # Inference
    gaussians_ndc = predictor(image_resized_pt, disparity_factor)

    # Postprocessing - unproject to 3D
    intrinsics = (
        torch.tensor(
            [
                [f_px, 0, width / 2, 0],
                [0, f_px, height / 2, 0],
                [0, 0, 1, 0],
                [0, 0, 0, 1],
            ]
        )
        .float()
        .to(device)
    )
    intrinsics_resized = intrinsics.clone()
    intrinsics_resized[0] *= internal_shape[0] / width
    intrinsics_resized[1] *= internal_shape[1] / height

    gaussians = unproject_gaussians(
        gaussians_ndc, torch.eye(4).to(device), intrinsics_resized, internal_shape
    )

    # Save to PLY file
    save_ply(gaussians, f_px, (height, width), output_ply_path)

    return gaussians.opacities.numel()


class CORSRequestHandler(BaseHTTPRequestHandler):
    """HTTP handler with CORS support for local development."""

    def log_message(self, format: str, *args: Any) -> None:
        """Log HTTP requests."""
        LOGGER.info("%s - %s", self.address_string(), format % args)

    def _send_cors_headers(self) -> None:
        """Send CORS headers for local development."""
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def _send_json(self, data: dict[str, Any], status: int = 200) -> None:
        """Send JSON response."""
        body = json.dumps(data).encode("utf-8")
        self.send_response(status)
        self._send_cors_headers()
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _send_binary(self, data: bytes, content_type: str, status: int = 200) -> None:
        """Send binary response."""
        self.send_response(status)
        self._send_cors_headers()
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _send_error_json(self, message: str, status: int = 500) -> None:
        """Send error JSON response."""
        self._send_json({"error": message}, status)

    def do_OPTIONS(self) -> None:
        """Handle CORS preflight requests."""
        self.send_response(200)
        self._send_cors_headers()
        self.end_headers()

    def do_POST(self) -> None:
        """Handle POST requests."""
        if self.path == "/api/predict":
            self._handle_predict()
        else:
            self._send_error_json("Not found", 404)

    def do_GET(self) -> None:
        """Handle GET requests."""
        if self.path == "/api/health":
            self._send_json({"status": "ok"})
        else:
            self._send_error_json("Not found", 404)

    def _handle_predict(self) -> None:
        """Handle file upload and run prediction."""
        content_type = self.headers.get("Content-Type", "")

        if "multipart/form-data" not in content_type:
            self._send_error_json("Expected multipart/form-data", 400)
            return

        try:
            # Read the body
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length)

            # Parse multipart data manually
            image_data, filename = self._parse_multipart(body, content_type)

            if image_data is None:
                self._send_error_json("Missing 'image' field", 400)
                return

            # Get extension from filename
            suffix = Path(filename).suffix or ".jpg"

            # Save uploaded file to temp location
            with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as f:
                f.write(image_data)
                temp_image_path = Path(f.name)

            # Create temp path for output PLY
            with tempfile.NamedTemporaryFile(delete=False, suffix=".ply") as f:
                temp_ply_path = Path(f.name)

            LOGGER.info("Processing uploaded image: %s", filename)

            try:
                # Run prediction and save to PLY
                num_splats = predict_image(temp_image_path, temp_ply_path)

                LOGGER.info("Prediction complete: %d splats", num_splats)

                # Read the PLY file and send as binary
                ply_data = temp_ply_path.read_bytes()
                self._send_binary(ply_data, "application/octet-stream")

            finally:
                # Clean up temp files
                temp_image_path.unlink(missing_ok=True)
                temp_ply_path.unlink(missing_ok=True)

        except Exception as e:
            LOGGER.exception("Prediction failed")
            self._send_error_json(str(e), 500)

    def _parse_multipart(
        self, body: bytes, content_type: str
    ) -> tuple[bytes | None, str]:
        """Parse multipart form data to extract image field."""
        # Extract boundary from content type
        boundary = None
        for part in content_type.split(";"):
            part = part.strip()
            if part.startswith("boundary="):
                boundary = part[9:].strip('"')
                break

        if not boundary:
            return None, "image.jpg"

        boundary_bytes = f"--{boundary}".encode()
        parts = body.split(boundary_bytes)

        for part in parts:
            if b'name="image"' in part or b"name='image'" in part:
                # Find the filename
                filename = "image.jpg"
                if b"filename=" in part:
                    # Extract filename
                    header_end = part.find(b"\r\n\r\n")
                    if header_end != -1:
                        header = part[:header_end].decode("utf-8", errors="ignore")
                        for line in header.split("\r\n"):
                            if "filename=" in line:
                                # Extract filename from Content-Disposition
                                start = line.find('filename="')
                                if start != -1:
                                    start += 10
                                    end = line.find('"', start)
                                    if end != -1:
                                        filename = line[start:end]
                                break

                # Extract file content (after double CRLF, before trailing CRLF)
                header_end = part.find(b"\r\n\r\n")
                if header_end != -1:
                    content = part[header_end + 4 :]
                    # Remove trailing CRLF and boundary marker
                    if content.endswith(b"\r\n"):
                        content = content[:-2]
                    if content.endswith(b"--"):
                        content = content[:-2]
                    if content.endswith(b"\r\n"):
                        content = content[:-2]
                    return content, filename

        return None, "image.jpg"


def run_server(host: str = "localhost", port: int = 8765) -> None:
    """Run the SHARP development server."""
    server = HTTPServer((host, port), CORSRequestHandler)
    LOGGER.info("SHARP server running at http://%s:%d", host, port)
    LOGGER.info("Press Ctrl+C to stop")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        LOGGER.info("Shutting down server")
        server.shutdown()


@click.command()
@click.option(
    "--host",
    type=str,
    default="localhost",
    help="Host to bind to.",
)
@click.option(
    "--port",
    type=int,
    default=8765,
    help="Port to bind to.",
)
@click.option("-v", "--verbose", is_flag=True, help="Activate debug logs.")
def serve_cli(host: str, port: int, verbose: bool) -> None:
    """Start the SHARP development server for frontend integration."""
    logging_utils.configure(logging.DEBUG if verbose else logging.INFO)
    run_server(host, port)
