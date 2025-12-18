FROM python:3.11-slim

WORKDIR /app

# Install ALL C++ dependencies and audio libraries
RUN apt-get update && apt-get install -y \
    # Build tools
    build-essential \
    gcc \
    g++ \
    make \
    cmake \
    # Audio libraries
    portaudio19-dev \
    libportaudio2 \
    libportaudiocpp0 \
    libasound2-dev \
    libasound2 \
    # Sound file support
    libsndfile1-dev \
    libsndfile1 \
    # FFmpeg for audio processing
    ffmpeg \
    libavcodec-dev \
    libavformat-dev \
    libswscale-dev \
    # Python audio bindings
    python3-pyaudio \
    # Additional utilities
    pkg-config \
    wget \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Upgrade pip
RUN pip install --upgrade pip setuptools wheel

# Copy requirements first (better caching)
COPY requirements.txt .

# Install Python packages
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create necessary directories with permissions
RUN mkdir -p interview_results uploaded_resumes && \
    chmod -R 755 interview_results uploaded_resumes

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:${PORT:-10000}/health || exit 1

# Expose port (Render sets $PORT dynamically)
EXPOSE ${PORT:-10000}

# Run with uvicorn
CMD uvicorn ws_server:app --host 0.0.0.0 --port ${PORT:-10000} --workers 1
