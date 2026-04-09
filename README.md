# PhysMind CLI

<p align="center">
  <b>Industrial Physics Brain — Expert AI CLI for Manufacturing, EV R&D, Robotics & CNC</b><br/>
  Built by <a href="https://physmind.ai">Keplore AI</a>
</p>

<p align="center">
  <a href="https://physmind.ai/install.html">Install</a>
  ·
  <a href="https://github.com/KeploreAI-Lab/physmind-cli-rust">GitHub</a>
  ·
  <a href="./rust/README.md">Rust Workspace</a>
</p>

---

## What is PhysMind CLI?

PhysMind CLI is a cross-platform terminal agent powered by Qwen (via Cloudflare proxy — no API key required). It lets engineers and teams in manufacturing, EV R&D, robotics, and CNC machining interact with PhysMind directly from the command line.

- No API key needed — uses Qwen via PhysMind's built-in proxy
- Works on macOS, Linux, and Windows
- Streaming responses with thinking display
- Session history, tool use, bash execution (`!` prefix)

## Install

**macOS / Linux:**
```bash
curl -fsSL https://physmind.ai/install.sh | sh
```

**Windows (PowerShell):**
```powershell
irm https://physmind.ai/install.ps1 | iex
```

## Quick Start

```bash
physmind
```

No API key setup required.

## Usage

```
physmind [OPTIONS] [PROMPT]

Options:
  --model <MODEL>       Model to use (default: qwen3.6-plus)
  --resume              Resume the latest session
  --output-format json  Machine-readable output
  --help                Show help
  --version             Show version
```

Run a bash command directly inside the REPL:
```
> !ls -la
```

## Build from Source

```bash
git clone https://github.com/KeploreAI-Lab/physmind-cli-rust
cd physmind-cli-rust/rust
cargo build --release -p rusty-claude-cli
./target/release/physmind
```

## Supported Platforms

| Platform | Binary |
|----------|--------|
| macOS (Apple Silicon) | `physmind-macos-arm64` |
| macOS (Intel) | `physmind-macos-x86_64` |
| Linux x86_64 | `physmind-linux-x86_64` |
| Linux arm64 | `physmind-linux-arm64` |
| Windows x86_64 | `physmind-windows-x86_64.exe` |

## About PhysMind

PhysMind is the industrial physics brain built by [Keplore AI](https://physmind.ai). Expert AI agents for manufacturing intelligence — from process optimization to EV battery inspection, robot calibration, and CNC machining.

- Website: [physmind.ai](https://physmind.ai)
- Support: support@keploreai.com
