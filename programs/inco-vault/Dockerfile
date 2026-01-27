# Use a base image with compatible Rust version
FROM rust:1.75-bullseye

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    pkg-config \
    libssl-dev \
    libudev-dev \
    clang \
    cmake

# Install Solana CLI
RUN sh -c "$(curl -sSfL https://release.solana.com/v1.18.18/install)"
ENV PATH="/root/.local/share/solana/install/active_release/bin:$PATH"

# Install Anchor CLI
RUN cargo install --git https://github.com/coral-xyz/anchor --tag v0.29.0 anchor-cli --locked

# Set working directory
WORKDIR /app

# Copy project files
COPY . .

# Build command (default)
CMD ["anchor", "build"]
