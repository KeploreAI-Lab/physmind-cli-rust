# PhysMind CLI

<p align="center">
  <b>The Industrial Physics Brain — Expert AI CLI for Manufacturing, EV R&D, Robotics & CNC</b><br/>
  Built by <a href="https://physmind.ai">Keplore AI</a> · Silicon Valley
</p>

<p align="center">
  <a href="https://physmind.ai/install.html">Install</a> ·
  <a href="https://physmind.ai">physmind.ai</a> ·
  <a href="./rust/README.md">Rust Workspace</a>
</p>

---

## What is PhysMind?

PhysMind is the industrial physics brain built by Keplore AI. It achieves state-of-the-art performance on industrial AI tasks through **expert agents** — not bigger models.

The paradigm shift: instead of scaling foundation models on general data, PhysMind packages industrial expertise as executable skill packages — physical equations, calibration procedures, acceptance criteria — invoked at inference time by agents.

> Industrial decision dependencies are not documents to retrieve — they are structured processes, physical equations, and acceptance criteria that must be executed.

**Where PhysMind works:**
- Manufacturing vision & defect detection
- EV battery & cell inspection
- Robotics integration & vision calibration
- CNC optimization & PLC integration

## PhysMind CLI

PhysMind CLI brings the industrial AI brain to your terminal. Powered by Qwen via PhysMind's built-in proxy — **no API key setup required**.

- Works on macOS, Linux, and Windows
- First launch prompts for a `kplr-` access key (one time only, saved automatically)
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

On first launch you'll be prompted for a PhysMind access key (`kplr-...`). Get one at [physmind.ai/install](https://physmind.ai/install.html). The key is saved to `~/.config/physmind/credentials` — you won't need to enter it again.

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

## Why Expert Agents, Not Bigger Models

Generic foundation models fail in industrial settings for four structural reasons:

1. **Models learn patterns — industry requires principles.** Physical laws and acceptance criteria can't be abstracted from text data.
2. **Industrial data doesn't exist publicly.** Calibration parameters, PLC quirks, factory protocols — none of this is in any training corpus.
3. **Probabilistic output fails in safety-critical settings.** A miscalibrated machine or failed inspection is not an acceptable error rate.
4. **Per-customer fine-tuning is operationally impossible.** PhysMind adds new verticals without retraining — by packaging expertise as executable skills.

## About Keplore AI

Keplore AI builds PhysMind — the industrial physics brain. Based in Silicon Valley.

- Website: [physmind.ai](https://physmind.ai)
- Support: support@keploreai.com
- Open source runtime: [physicalflow-runtime](https://physmind.ai)
