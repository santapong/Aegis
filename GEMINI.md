# GEMINI.md: Project Blueprint - "Aegis" Autonomous Wealth OS

## 1. Core Concept
Aegis is an AI-driven financial operating system that treats personal wealth generation as a managed, automated project. It goes beyond passive tracking by actively generating financial tasks, forecasting timelines via Gantt charts, and visualizing cash flow liquidity.

## 2. Feature Mapping (The Core 5)

* **1. Financial Planning Core:** A robust double-entry ledger system.
* **2. AI Decision Engine (The Advisor):**
    * **ML/DL:** Utilize an LSTM or time-series model to predict future account balances based on historical spending velocity. 
    * **Agentic AI:** Use LangChain to create an "Advisor Agent." It analyzes ML predictions to propose decisions (e.g., "Delay hardware purchase by 2 weeks to maintain your minimum liquidity threshold").
* **3. The Liquidity Sankey:** A dynamic Sankey diagram showing the exact flow of money: `Income Sources -> Tax/Fixed Costs -> Discretionary Spending -> Specific Investment Buckets`.
    * 
* **4. Algorithmic Todo List:** The AI generates actionable, trackable tasks, mirroring tools like ClickUp, strictly for financial execution.
* **5. Goal-Oriented Gantt Charts:** Visualizing long-term targets.
    * 

---

## 3. The Implementation Roadmap (The 6 Core Epics)

### Epic 1: The Automated Ledger
**Goal:** Establish the ground truth of the finances with zero manual data entry.
* **Infrastructure:** Litestar API, PostgreSQL, and a React/TypeScript frontend for the Liquidity Sankey.
* **Automation:** Deploy n8n and Kafka to automatically ingest bank CSVs and email receipts, streaming them directly into the database. 
* **Outcome:** A lightning-fast, self-updating double-entry ledger.

### Epic 2: The Intelligent Engine
**Goal:** Give the system a brain and the execution speed to use it.
* **AI & Storage:** Implement LangChain for the RAG pipeline and connect it to a self-hosted Garage storage instance to manage tax documents and receipts.
* **Acceleration:** Rewrite the heaviest forecasting algorithms in Rust or Mojo, using Foreign Function Interfaces (FFI) to let the Python backend call them instantly.
* **Outcome:** Natural language querying of financial history with complex computations processing without lag.

### Epic 3: Distributed CaaS & Telemetry
**Goal:** Transform the single app into an enterprise-grade, monitored infrastructure.
    * 
* **Multi-Agent Microservices:** Break the AI into specialized departments (e.g., Auditor, Strategist) packaged in Docker containers and managed by Dokploy and Kubernetes.
* **Hardware Routing:** Split the compute load. Send lightweight n8n ingestion to the Raspberry Pi 5 (16GB), and keep the heavy ML and Rust simulations on the primary 4-core, 32GB RAM Kali Linux workstation.
* **Security & Auditing:** Implement KQL logging to hunt for anomalies and enforce strict network access controls via Filebrowser and Garage.
* **Outcome:** A fully distributed, heavily monitored homelab acting as a personal financial company.

### Epic 4: The Quantum-Inspired Oracle
**Goal:** Predict the future using high-performance mathematics.
* **Simulation Engine:** Leverage Mojo to run 10,000+ Monte Carlo simulations against the financial trajectory.
* **Quantum Prototypes:** Implement classical algorithms inspired by QAOA to solve complex asset allocation problems (e.g., maximizing yield while retaining absolute liquidity).
* **Outcome:** The system stress-tests long-term goals against thousands of economic variables and dynamic market conditions.

### Epic 5: Autonomous Execution & Engagement
**Goal:** Let the system execute tasks while maintaining user motivation.
* **Gamification:** Use the Kafka event stream to trigger UI milestones when adhering to the Gantt chart for consecutive days. Frame financial discipline through a progression system, applying logic to measure standing or "rank" within the Aegis system.
* **Headless Banking:** Implement Playwright to allow the AI to actively execute internal transfers (shifting money to savings when thresholds are met) pending a one-click user approval.
* **Outcome:** Aegis stops just giving advice and begins executing the financial strategy itself.

### Epic 6: The Singapore Transition
**Goal:** The ultimate endgame execution for educational deployment.
* **Cross-Border Logistics:** Implement multi-currency ledgers handling THB to SGD conversions natively.
* **Milestone Tracking:** Automate the strict tracking of student visa proof-of-funds generation and map out the timeline for liquidating local assets or allocating scholarship disbursements.
* **Outcome:** A seamless, mathematically proven financial runway for the 2027 Master's degree intake.