FROM solanalabs/solana:stable

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    pkg-config \
    libssl-dev \
    libudev-dev \
    git \
    curl \
    clang \
    cmake

# Install Rust (latest stable for 2026 compatibility)
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain stable
ENV PATH="/root/.cargo/bin:$PATH"

# Install Anchor CLI (matching Cargo.toml version)
RUN cargo install --git https://github.com/coral-xyz/anchor --tag v0.30.1 anchor-cli

# Set working directory
WORKDIR /app

# Copy project files
COPY . .

# Reset entrypoint to avoid running the validator by default
ENTRYPOINT []

# Build command (default)
CMD ["anchor", "build"]
