**ModuMind OS: Agent Operational Manual v2.0**

This manual outlines the **Intent-to-Documentation Pipeline** architecture, replacing the original keyword-based "Receptionist" model. All agents must operate within this security-first, governance-driven framework, where high-level Strategic Plans (SOPs) are the single source of truth for all documentation generation.-----1. Agent Architecture Shift (v2.0)

The system pivots to a top-down structure where human C-Suite oversight dictates **Intent** via ERPNext, and two core agents govern **Execution**.Key Agents and Core Functions

| Agent (Role) | Core Function in v2.0 | Enforcement/Protocol |
| ----- | ----- | ----- |
| **Strategic Intent Mapper (SIM Agent)** | Intercepts requests, cross-references with SOPs, and generates comprehensive, parameterized prompts for specialist agents. | Protocol 2: Zero-Trust Prompt Security |
| **SOP Compliance Auditor (SCA Agent)** | Reviews final output against the immutable Strategic Plan (SOPs). Applies the **Security & Compliance Seal** upon validation. | Protocol 1: Documentation-First Mandate |
| **Quality Assurance (QA) Agent)** | Validates implementation against contracts, writes tests, and enforces the **Component Integrity Check** (Protocol 4). | QA Rework Rate (Target: \< 2%) |
| **Document Maintenance Agent** | Performs Differential Analysis and Patching for updates to existing documents, avoiding full regeneration. | Patch Application Success Rate (\> 99%) |
| **Modular Content Componentization Agent** | Extracts key narrative elements and stores them as reusable, certified content blocks to ensure a "single source of truth." | Modular Component Reusability Rate |
| **Automated Integrity Agent** (New) | Validates codebase state against the last known QA-validated state at the start of every session, preventing integration drift. | Regression Prevention |
| **Static Analysis Agent** (New) | Runs linting and type-checking *before* the implementation step to catch errors early, reducing the QA rejection rate. | Early Bug Detection |
| **Router Agent** | Entry Point/Initial Classifier. | Router Efficacy KPI |

\-----2. Operational Flow: Intent-to-Documentation Pipeline

All specialist agents (Documentation, Content, Educational) must execute tasks according to this 7-step flow, ensuring direct and secure translation of CEO intent to final documentation.

| Step | Action and Source | Agent Responsibility |
| ----- | ----- | ----- |
| 1\. **CEO Action (Intent)** | CEO modifies a high-level Strategic Plan (SOP) within **ERPNext**. | **Human Layer:** Sets the "What." |
| 2\. **SOP Validation (Security)** | The SOP modification is logged onto the **Blockchain** and pushed to the SIM Agent. | **System/ERPNext:** Immutable audit trail and execution trigger. |
| 3\. **SIM Agent Activation (Translation)** | SIM Agent reads the updated SOP and automatically queues associated downstream deliverables (e.g., updates Operational Manual). | **SIM Agent:** Initiates the workflow. |
| 4\. **Prompt Generation (Automation)** | SIM Agent automatically inserts the updated SOP content as mandatory instructions for the Specialist Agent, achieving **Prompt Parameterization**. | **SIM Agent:** Enforces Protocol 2 (Zero-Trust Prompt Security). |
| 5\. **Specialist Agent Execution (Generation)** | SIM Agent hands the parameterized prompt and content to the target specialized agent (e.g., Documentation & Guidelines Agent). | **Specialist Agent:** Generates the draft deliverable. |
| 6\. **Quality & Compliance Check (Audit)** | The draft output is simultaneously reviewed. | **QA Agent:** Checks against deliverable checklist. **SCA Agent:** Verifies mandatory SOP elements. |
| 7\. **Final Document Creation** | Once approved, the document is published with a **Security & Compliance Seal** (Blockchain/SCA verified hash). | **SCA Agent / System:** Final secure publication. |

\-----3. Mandatory Operational Protocols (v2.0)

All agents must adhere to the following protocols, enforced by the governance agents:

| Protocol | Enforcement Agent | Rule |
| ----- | ----- | ----- |
| **Protocol 1: Documentation-First Mandate** | **SCA Agent** | Every autonomous workflow or software feature must have a final, *SOP Compliance Audited* **Operational Manual** or **Component Guide** published *before* the code or process is executed. |
| **Protocol 2: Zero-Trust Prompt Security** | **SIM Agent** | No Specialist Agent is permitted to execute a task based on a prompt that has not been parameterized, stamped, and verified by the SIM Agent using variables derived directly from the immutable, hashed Strategic Plan (SOPs). |
| **Protocol 4: Component Integrity Check** | **Quality Assurance Agent** | The QA Agent must flag any instance where common concepts are defined manually or inconsistently, forcing the agent to use the version extracted and stored by the **Modular Content Componentization Agent**. |

\-----4. Specialist Agent Deliverables and Skills

Agents must prioritize the following Core Skills when executing their assigned tasks:A. Documentation & Guidelines Agent (Internal Structuring)

| Target Deliverables | Core Skills |
| ----- | ----- |
| Operational Manual, Governance Framework, Component Guide | Structure Definition, Protocol Formatting, Detailed Analysis, Documentation Rules, MindScript Method Utilization, Documentation-First Protocol Application. |
| **Prompt Goal** | "Generate detailed, official documents, defining the structure, style, and tone as requested." |

B. Content Distillation & Refining Agent (Controlled Broadcast)

| Target Deliverables | Core Skills |
| ----- | ----- |
| Briefing Document, Professional Article, Process Overview | Summary Generation, Key Takeaway Extraction, Step-by-step Depiction, Quotation Mining, Reusable Component Generation (for Protocol 4). |
| **Prompt Goal** | "Distill the initial content to create the requested output. Prioritize digestibility and key takeaways. For processes, create a clear, step-by-step depiction." |

C. Educational Agent (Structured Interaction)

| Target Deliverables | Core Skills |
| ----- | ----- |
| Educational Resource | Quiz Generation, Essay Prompt Creation, Glossary Construction. |
| **Prompt Goal** | "Transform the initial content into an educational resource. The final output must include a short-answer quiz, suggested essay prompts, and a glossary of key terminology." |

