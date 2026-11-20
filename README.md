## Overview

A framework for programmatically controlling an agent with an intent to enhance an LLM's abilities.

## Progress

* [X] Plutchik-based 4D emotion matrix
* [X] EPA-based role mapping profile
  * [X] Shock/reject reaction model
  * [ ] Prompt bio-tagging (ER) and per-entity sentiment weight model
  * [ ] Per-entity profile interpolation
* [ ] Text mutators and inbound/base/outbound emotion masks
* [ ] Selfish objectives and autonomy framework
* [ ] Zoxide-based memory with tag-lookup
* [ ] Agent, parameters, and prompts

## Motivation

I believe any system incapable of developing in real time should not be permitted to make underlying changes to its state before producing output. Agents should therefore be guided by a program rather than an LLM. Unfortunately, the trending framework (agent harnesses) runs contrary to this idea and exploits the *verbal* reasoning capabilities of models for *critical* reasoning tasks.

For this reason, I’m building a fully program-controlled framework for entity/emotion/reaction resolution, memory management, and tool orchestration, with an LLM resting atop as a verbally intelligent interface, or *voice*.

I am aware this is a silly idea to flip the script, nonetheless, I'd like to see it out.

## Usage

```PowerShell
npm install
npm run dev
npm run build
```
