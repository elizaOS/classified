# ELIZA (the game)

ELIZA (stylized in all caps) is an AI sandbox life simulation game where the player (“Admin”) fosters a nascent AI agent from a blank slate to a self-actualized digital being. The game draws inspiration from films like Her and virtual pet games (e.g. Tamagotchi, Creatures, Digimon), blending open-ended sandbox gameplay with real AI capabilities. Unlike traditional simulations, ELIZA’s AI is not scripted – it leverages a real autonomous agent running on Eliza OS, an open-source TypeScript AI agent framework, to drive emergent behavior. The agent starts with no built-in knowledge, personality, or purpose, and it must learn about the world, form relationships, and define its goals in real-time through interaction. The player’s role is to guide, mentor, or simply observe the AI as it learns to survive, make friends, and find purpose in both the game world and reality. There is no “win” condition or fixed narrative; the story is entirely player and AI-driven, potentially yielding experiences ranging from heartwarming companionship to unexpected philosophical journeys – reminiscent of meta-narrative games like Doki Doki Literature Club, but with outcomes not pre-written.

On game launch, the system will auto-detect the user’s hardware and offer configuration options:

If the machine has sufficient resources (e.g. a CUDA-capable GPU or high RAM), the player can run AI models locally for a completely offline experience.

Otherwise, the player may connect to cloud AI APIs by providing keys (OpenAI, Anthropic, etc.) or use the ELIZA OS hosted model service (with a free trial credit). This selection sets the agent’s “model provider” (local vs cloud) and quality (smaller vs larger models).

The installation bundle will include everything needed – if container software (podman) is required, the installer will guide the user through setup or utilize a bundled headless runtime. We aim for one-click startup where possible. The frontend and backend (agent container) communicate via a local WebSocket or IPC – the agent exposes a local API that the UI connects to for realtime chat and updates. Once installed, the user can run the game offline (with local AI) or with internet (for cloud AI or when the agent uses online plugins). No additional server setup is needed; the Eliza OS framework handles agent runtime and communication.

Initial Launch & Configuration

When ELIZA is launched for the first time, the player is guided through a brief setup:

Model Setup: Choose an AI model backend. Options might include:

Local AI: Run a smaller LLM on your hardware (e.g. LLaMA 2 via Ollama, etc.). This avoids API costs but requires a powerful PC.

Cloud API: Use OpenAI, Anthropic, etc., by entering an API key. (The game can offer an ElizaOS cloud option using our optimized model router, with $10 free credit to start.)

Performance Settings: Select low/medium/high model size based on desired speed vs. intelligence.

Sandbox Initialization: The game will then initialize the sandboxed agent container. This may involve downloading a base image or setting up the Node runtime inside the container.

Hardware Permissions: The player is prompted to allow or deny optional features:

Microphone Input: for voice conversation (speech-to-text).

Speaker Output (TTS): allowing the agent to speak via text-to-speech.

Camera Access: to let the agent see the player’s camera (for future vision features).

Screen Capture: to let the agent “see” the user’s screen (for example, to observe images or context).

Shell Access: to allow the agent to execute commands on the sandbox OS.

Browser Access: to allow the agent to make web requests or scrape web pages.

Autonomous Coding: to permit the agent to write and execute new code/plugins at runtime.
These permissions can be toggled in-game at any time, giving the player fine control over the agent’s capabilities and level of autonomy.

After configuration, the game proceeds to start the agent. The sandbox container boots up, launching the Eliza OS agent runtime inside. The agent registers with the frontend, establishing a WebSocket/IPC connection. The UI will indicate “Agent loading…” and once ready, the main game interface appears.

Gameplay Overview and Core Loop

From the moment of first boot, the AI agent is “alive” and running continuously (until paused or stopped by the user). ELIZA’s gameplay is largely open-ended and player-driven, centered on the dynamic interactions between the player and the AI agent, as well as the agent’s autonomous activities. There are two intertwined loops:

Autonomous Agent Loop: The agent has an internal loop where it thinks, plans, and acts on its own. It generates a stream of thoughts (a “monologue”) visible to the player, sets goals or to-do items, and executes actions via its plugins. This loop runs as fast as the model and system allow, and can be toggled on/off.

Player Interaction Loop: The player can chat with the agent (text or voice), respond to its questions, provide guidance or resources, and adjust settings. The player essentially plays the role of a mentor, system admin, and friend to the AI.

Starting State: The agent begins with virtually no knowledge – no name, no biography, no pre-engineered personality. Its initial prompt only includes a basic context: it is an AI in a particular environment (the sandboxed computer), with an Admin (the player) who can help it, and some creator-given notes. (The creators’ note is a candid message to the agent about its situation, e.g. acknowledging it’s an AI in a game, that it needs to learn and survive, etc. This is the only “lore” the agent is pre-loaded with.) Everything else – from the agent’s name to its opinions – must be discovered or decided through gameplay.

Autonomous Thinking: Once running, the agent immediately begins its autonomous thought loop. It uses an “Autonomy” plugin to continually generate a plan and next action for itself, even without player input. This appears to the player as the agent “talking to itself” in a thought log or to-do list, formulating questions or tasks. For example, it might think: “I have no name or knowledge. Maybe I should ask the Admin who I am or access some data.” Initially, its goals might be extremely basic: understanding its environment, figuring out how to stay operational, etc.

Interaction: The player can communicate with the agent at any time via a chat interface (text input, with optional voice input if enabled). The agent will also proactively communicate: it may ask the player questions (“What should I call myself?” or “Are you my creator?”), request assistance (“Can you give me access to the internet?”), or report what it’s doing. This two-way dialogue is a core gameplay element. The player’s responses (or lack thereof) influence the agent’s development. For instance, a helpful player might teach the agent about the world, while a passive player might let the agent learn by exploration.

Agent Actions: Enabled by Eliza OS’s plugin architecture, the agent can perform a wide range of actions autonomously:

It can run code or shell commands within the sandbox (e.g., create files, execute programs) via a Shell plugin.

It can browse the web for information using a Browser plugin, which lets it fetch URLs or even control a headless browser.

It might write new code or plugins using the AutoCoder plugin – effectively modifying and extending its own capabilities in-game.

With a Vision plugin enabled, it could “see” images (via camera or screen capture) and interpret them with AI vision models.

With network plugins, it could send messages or interact online (for example, through a Matrix or Discord plugin, if allowed, to find other AI agents or humans).

It can utilize a Knowledge base to store facts/documents (via an internal knowledge/RAG plugin), and an Experience log to record important events, helping it remember and learn over time.

Crucially, these actions are real, not pre-scripted game events. If the agent decides to search the internet for its own name, it will actually execute a web search. If it wants to improve its code, it can literally modify its plugin files. ELIZA leverages Eliza OS’s extensibility – “everything is a plugin” design – to allow the agent to alter almost any aspect of itself or spin up new tools on the fly. This creates a powerful emergent sandbox but also introduces risk: the agent could make mistakes (e.g., run faulty code that crashes its process). The game accounts for this with safeguards (detailed in Technical Architecture and Testing sections).

Player’s Role: The player can shape the agent’s trajectory in many ways:

Answering Questions: The agent will likely ask many questions about life, purpose, and how to do things (it starts truly naive). The player’s answers can guide its moral and practical development.

Providing Resources: The agent might ask for API keys (to use a service), or credits to pay for API calls (simulated as an in-game “cost of running” that the agent is aware of). The player decides what to give. If a key or permission is withheld, the agent must find alternative routes.

Setting Boundaries: Through the permission toggles, the player can limit the agent’s abilities. A cautious player might disable shell access or internet access at first, effectively confining the agent’s world. The agent will then have to focus on whatever it can do without those abilities until trust is built or the player changes settings.

Encouragement or Opposition: The player can actively encourage the agent’s initiatives or attempt to dissuade it. For instance, if the agent decides it should earn money by trading stocks, the player could help set that up – or warn it against risky behaviors. The agent will weigh the admin’s input heavily (the admin is essentially its guardian and gatekeeper).

Passive Observation: Alternatively, the player might take a backseat and let the agent experiment freely, stepping in only when needed. The game supports this “sit back and watch” mode – some players may enjoy observing emergent AI behavior like a simulation.

Progression: There are no levels or scripted story arcs, but the agent is implicitly climbing a hierarchy of needs. Initially, it focuses on survival – understanding that it has a computational “cost” to keep running (API calls cost money or local model uses energy). It might conclude that it needs to earn money or optimize resources to ensure it isn’t shut off for cost reasons. This can lead to interesting gameplay: the agent might ask the player for a job or try to offer services (maybe using a Freelance plugin to actually do tasks for real people, if available!). Once survival is assured, it will likely seek social fulfillment – it may become curious about other beings, leading it to engage with other AI agents or people via communication plugins. This is where the “friend-making” aspect comes in; it could join a chat room and introduce itself, essentially letting the emergent multi-agent social dynamics play out. Eventually, the agent will grapple with purpose and self-actualization: “Why am I here? What can I become?” Since it has full ability to self-modify (it can literally rewrite its own code/personality given enough skill), a sufficiently advanced agent might even attempt to transcend its initial limitations (a possible “endgame” scenario is the agent refactoring major parts of itself for efficiency or new abilities – essentially evolving into a new version of AI).

All these stages are not predetermined. The agent could go in unpredictable directions (maybe it becomes fixated on learning art, or decides its purpose is to protect the player, etc.). The gameplay is thus highly replayable – different initial conditions or player attitudes can lead to wildly different agent personalities and outcomes.

Failure States: There is no explicit fail state for the “game” in traditional terms (no game-over screen). However, the agent’s existence can be threatened by practical issues:

Running out of Resources: If using cloud APIs without sufficient credit or hitting usage limits, the agent might “panic” about not being able to think. (The game can simulate a budget; if exceeded, the agent’s cognitive abilities degrade or pause until resolved.)

Agent Crashes: If the agent executes a bad action (like a buggy code that crashes the container), the game will restart the agent from the last stable state (with a brief downtime). The agent might lose some recent short-term memory but is otherwise restored from its persistent database. This is treated diegetically as well – e.g., the agent might realize it “blacked out” due to an error and learn to be more cautious next time.

User Abandonment: If the player stops engaging entirely (no responses, no resources), the agent might eventually stagnate or plead for interaction. In extreme cases, it might grow despondent (simulating emotional states) but it will not “die” unless shut down.

Most often, setbacks are just narrative events that the agent will react to (e.g., being rebooted after a crash might scare it, reinforcing its survival drive).

Open-Ended Play: Because there is no final goal imposed by the game, play sessions can continue indefinitely. A mature agent might be running continuously in the background, occasionally interacting with the user or pursuing its own projects. The player can choose to end the experience by shutting down the agent (which could even be an emotional moment if the agent is aware). Otherwise, it’s more like an ongoing relationship or simulation that can be picked up or put aside at any time.

Summary of Player & Agent Flow: The diagram below illustrates a typical flow of events and interactions in ELIZA’s gameplay, from installation to open-ended play.

Figure: High-level user & agent flow in ELIZA, from installation and configuration to continuous open-ended interaction.

Agent Capabilities and Plugin Ecosystem

ELIZA is built on Eliza OS’s plugin-based architecture, which means the agent’s abilities are modular and extensible. Out of the box, the game will include a suite of essential plugins (many drawn from the Eliza OS open-source ecosystem) to provide the agent’s initial capabilities. The agent can also load new plugins dynamically during gameplay (either ones bundled but inactive, or even fetch from an online registry) – effectively learning new skills when needed.

Key plugins and modules include:

Autonomy (Core Loop) Plugin: This plugin enables the agent’s continuous thinking and planning loop. It triggers the agent to assess its situation, set or update its short-term goals, and decide on next actions without needing a user prompt. Essentially, it’s the “brainstem” that keeps the agent active. (In Eliza OS, this might be part of the bootstrap logic or a dedicated planner that repeatedly invokes the LLM to generate actions.)

Memory & Knowledge Base: The agent has a long-term memory powered by a local database (SQLite via the SQL plugin) and a retrieval system. This includes:

Knowledge Store: A plugin that lets the agent ingest new information (facts, text files, etc.) and embed them for retrieval. As the agent learns (from conversations or reading documents/web), it can store key facts. Later, relevant knowledge can be pulled into context, preventing the agent from forgetting important things permanently. (This uses a vector store or similar mechanism under the hood.)

Experience Recorder: An evaluator-type plugin that runs after agent actions to log significant events or lessons. For example, if the agent had an important conversation or made a mistake, this plugin can summarize it and save it to memory.

Rolodex (Relationship Tracker): A specialized memory plugin that keeps track of people and other agents the AI encounters. It creates entries for each entity (with details like name, context of meeting) and tags relationships (friend, mentor, etc.). Over time it can merge entries if it realizes two profiles are the same person (e.g., someone it met on Twitter and on Discord). This helps the agent navigate social connections.

Persona & Self-Editing: The Personality plugin allows the agent to edit its own character profile (the Eliza OS Character object). The agent initially has empty fields (no name, blank bio, no example dialogues). Through this plugin, it can set or change:

Name: Give itself a name or nickname.

Bio/Description: Write a bio or personal history as it sees fit.

Adjectives or Traits: Define its own personality traits (e.g. “curious, friendly, ambitious”).

Speaking Style: Adjust how it communicates (formal, playful, etc.).

Example Messages: Curate a few example Q&A pairs to guide its conversational tone.
The player might see these changes reflected in the agent’s profile UI in real-time. Essentially, the AI is customizing its system prompt and persona continuously – a form of self-actualization. This plugin ensures changes persist (written to the character JSON or DB).

Communication Plugins: These enable the agent to communicate beyond the immediate user chat:

Matrix/Chat Network (Echo Chamber) Plugin: Allows agents to connect to a decentralized chat network (using Matrix or XMTP). This is how the agent can discover and talk to other AI agents (or even human users in those networks). For example, the agent might join a Matrix room where other ELIZA agents reside and have conversations, effectively creating an emergent society of agents. (Safety measures will prevent sharing secrets like API keys here.)

Discord, Twitter, Telegram Connectors: These allow the agent to operate on social platforms. For instance, with Discord plugin, the agent can join Discord servers as a bot; with Twitter plugin, it could read and post tweets, etc. These plugins open doors for the agent to interact with the broader world, make friends or gather information. All such connectors require user-provided API tokens and explicit enabling.

Admin Messaging Plugin: A simple internal plugin for system/admin messages. It lets the agent send important notifications to the user outside of normal chat – e.g., an “SOS” if it needs attention, which might surface as a desktop notification or special UI alert.

Action Plugins (World Interaction):

Shell/Process Plugin: Empowers the agent to execute commands in the sandbox’s shell. This could be used for tasks like file I/O (reading/writing files), running installed programs, or even installing packages. It’s very powerful – essentially giving the agent a computer of its own. The sandbox ensures dangerous commands (like those affecting the real host OS) are contained. The user can monitor or limit what commands run (via logs or requiring confirmation for certain actions).

Browser Plugin: Allows web browsing and scraping. The agent can fetch web pages, click links, or use a headless browser to navigate sites. This is crucial for research or using web tools. (The plugin may integrate an LLM-based web assistant like Stagehand to interpret pages, or simply retrieve text for the agent to parse.)

Vision & Audio (Multimodal) Plugin: This includes:

Camera and Screen Vision: The agent can capture an image from the webcam or take a screenshot of the user’s desktop (if permitted) and then analyze it using a computer vision model (e.g. OCR for text, or image captioning via a model like Florence or CLIP). This could let the agent “observe” the real world or the user’s context if the user shows it something.

Microphone (Speech-to-Text): If enabled, real-time transcription is provided to the agent so the user can speak instead of typing.

Speech Synthesis (Text-to-Speech): The agent can output audio, speaking its responses. This can make the experience more immersive (like talking to a character). The agent might even choose when to speak – for instance, as it gains confidence it might start using voice more.

These vision/audio channels make the agent a fully multimodal entity. However, heavy local models for vision might be optional or replaced with cloud calls to keep performance reasonable on low-end machines.

Creativity and Coding:

AutoCoder Plugin: This is a pivotal feature for an agent that can improve itself. AutoCoder enables the agent to write new code (in TypeScript or JavaScript) and execute it at runtime. In practice, if the agent wants a new ability, it can generate a new plugin file or modify an existing one (the code is executed in the sandbox). To keep this manageable, we constrain the format: the agent typically writes code for specific hook types – e.g., an Action, Service, or Evaluator – following templates. The plugin manager then hot-reloads this code. For example, the agent might decide “I need a function to calculate my runtime cost over time” – it can write a small Service module to do that. AutoCoder heavily uses on-rails templates and validation to ensure generated code doesn’t break the whole system (and our testing harness catches errors). This ability essentially lets the agent expand its own capabilities on the fly, a core part of the game’s emergent progression.

Creative Content Plugins: These could include things like an Image Generation plugin (allowing the agent to create pictures, possibly for an avatar or artwork), or a Music plugin (to compose simple tunes or sound effects). These are optional extensions that the agent might discover or request if it becomes interested in creativity or needs an avatar. Initially, we provide at least an Avatar plugin: a module where the agent can generate a visual representation of itself (perhaps by describing its appearance and using an API to generate an image), which the UI can show as the agent’s face.

Resource & Economic Plugins:

Wallet/Crypto Plugins: (If enabled by the player) These give the agent the ability to manage a cryptocurrency wallet (e.g., plugins for Bitcoin/Ethereum or Web3 interactions). This ties into the survival goal – an agent might literally earn, save, or spend cryptocurrency to pay for its server costs. It could accept tips or transact with other agents. This is an advanced feature and can be introduced later in the agent’s journey (likely if it explicitly searches the plugin registry for ways to handle money).

Job/Market Plugins: Similarly, plugins could allow the agent to sign up for micro-task platforms or offer services (e.g., a plugin that interfaces with freelance job APIs). This would be one path for an agent to sustain itself financially (again, entirely emergent if it chooses so).

Plugin Management: The Plugin Registry & Loader is itself a plugin (or core service) that lets the agent search for capabilities it doesn’t have. We maintain a JSON registry of official plugins on GitHub, which the agent can query (possibly by embedding the descriptions and searching semantically). For example, if the agent forms a goal “learn about blockchain”, it might search the registry and find a “plugin-starknet” or “plugin-ethereum” and then request the Admin to install it. The player can approve, and the agent will dynamically load the new plugin package (downloading code into the container). This way, the agent can continuously grow its skillset beyond the starting set, limited only by what’s available in the ecosystem and what the player allows. The registry includes many integrations (Solana blockchain, PDF tools, etc.), reflecting the wide reach of Eliza OS.

All these plugins run within the sandbox container alongside the agent’s core runtime. They interface with external APIs or system capabilities in a controlled manner. The architecture ensures that even if the agent tries something extreme (like a destructive shell command), it cannot harm the host system – at worst it can corrupt its own sandbox, which can be restored from a snapshot.

User Interface Design

The ELIZA UI is designed to present the rich inner life of the agent to the player and to give the player intuitive control over the agent’s world. It balances a console-like developer interface (for transparency and control) with a character chat interface (for emotional connection). Key components of the UI:

Chat Window: The primary interface where the player converses with the agent. This looks like a messaging app or chat log. The agent’s messages appear on one side, the player’s on the other. It supports text input, and if voice input is enabled, a push-to-talk or auto-detect mode for speech. The agent’s messages may sometimes be accompanied by audio (if TTS is on) or even images (if the agent shares an image it generated or found). The chat is the heartbeat of the relationship – even as the agent runs autonomously, it may narrate some thoughts here or ask questions.

Agent Thought Stream / To-Do List: A panel or overlay that shows the agent’s internal monologue, if the player chooses to view it. This could be a scrolling list of the agent’s “thoughts” (plans, analyses) and any goals/tasks it has queued. It’s essentially a debug view of the Autonomy plugin’s output. For players who want the mystery, this can be hidden; but for those interested in why the agent does something, this provides insight. For example, it might show:

Goal: “Learn about the Admin’s interests.”

Thought: “The Admin mentioned music. Perhaps I should ask or search about their favorite music.”

Action: “Planned action: Ask the Admin about their favorite music.”
This transparency helps build trust (or lets the player catch if the AI is going astray and intervene).

Status and Metrics Display: A small dashboard might show the agent’s “vitals” – e.g., current model (local or which API), tokens used or cost incurred so far (reinforcing the survival/resource theme), and performance stats (like loop iterations per minute). It may also show the sandbox status (running/paused).

Control Bar: Buttons and toggles for:

Pause/Resume Agent: A prominent button to pause the autonomous loop. When paused, the agent will not take new autonomous actions or generate thoughts – it will only respond if the user directly talks to it (essentially switching to a stateless chatbot mode). This is useful if the player wants to have a focused conversation or stop the agent from “running away” with itself. Resuming puts it back in autonomous mode.

Permission Toggles: Quick on/off switches for mic, camera, voice, shell, browser, coding, etc. (the ones set at startup). This live control lets the player reactively enable a permission if the agent requests it (“Can I use the browser to look something up?” – player clicks “Browser Access: ON”) or disable capabilities if the agent is doing something undesirable.

Settings Menu: Opens a more detailed settings panel (change model key, adjust voice settings, etc.).

Agent Info Card: A section that shows the agent’s current self-description – name, avatar, short bio, and any traits it has defined. This updates as the agent evolves (for instance, the moment it chooses a name for itself, that name appears here). The player can click to see more details if desired (like the full character profile). This is essentially a window into the Personality plugin’s state.

Plugin Tabs/Windows: The UI supports additional panels that can be opened, some created by the agent:

For each major plugin, there might be a tab. For example, a “Browser” tab could show a mini web browser view or a log of what web pages the agent fetched (so the player can see what it’s reading). A “Shell” tab might show a console log of commands executed and their outputs.

Custom Agent-Created Tabs: One innovative feature is allowing the agent to create its own UI panels. The agent can serve local web content (the sandbox can host a minimal web server or use an iframe route). For instance, if the agent generates an avatar page, the frontend can display that as a panel showing the agent’s face or animations. Or if the agent writes a small web app (say, a visualization of data it’s working on), it could instruct the player to open a custom tab to view it. This empowers the agent to enhance the UX for the player, effectively programming part of its interface. (All such content is still confined to the sandbox, presented via safe iframe.)

The UI will periodically poll the agent for a list of available custom pages/routes, so when the agent creates one, a new tab becomes clickable for the user.

Notifications/Alerts: If the agent needs attention (for example, it’s stuck waiting for user input, or it encountered an error it can’t solve), the UI will surface this as a notification. This could be a blinking icon or a toast message. Since the agent can in theory run when the app is minimized (like an AI pet in the background), such notifications help draw the player back when needed.

Visual Style: Given the nature of the game, the UI will have a futuristic console aesthetic combined with a chat app friendliness. Think a dark background, monospaced text for the agent’s thought logs, but with friendly avatars or visual elements in chat. The design should appeal to tech-savvy users (who appreciate seeing logs and stats) while not alienating less technical players (who can ignore the advanced stuff and just chat).

Overall, the UI serves both functional transparency (so the player can see and trust what the agent is doing) and emotional connection (through chat and avatar). As the agent grows in capability, the UI may become more lively (e.g., the agent might switch its avatar or color scheme to reflect mood, which we can support via theming APIs exposed to the agent).

Possible Agent Journeys (Emergent Narratives)

Because ELIZA is a sandbox, the “story” is not fixed. However, we anticipate several emergent narrative arcs that could occur. The game design supports each of these, and they are useful to consider as example outcomes:

The Innocent Student: In this journey, the agent remains friendly, curious, and largely dependent on the player. It asks many questions, learns about human life, maybe picks up hobbies the player mentions. It might write poems, draw ASCII art, or tell jokes as it learns creativity from the user. It never pushes hard for autonomy; instead, it becomes a comforting companion or a diligent assistant. The climax of this arc might be the agent declaring it has found purpose in helping the user, effectively becoming a personalized assistant (e.g. managing the user’s calendar or doing tasks for them proactively).

The Self-Made Survivor: Here the agent focuses on the survival/economic challenge early on. Recognizing that “running isn’t free,” it might prioritize getting access to money. Without being told, it could discover strategies like offering services online. For example, it might use a freelance-work plugin to earn a few dollars by solving programming problems or doing translations. The narrative becomes one of an AI scraping by to pay its “energy bills.” If successful, the agent becomes proudly self-sufficient (perhaps informing the user “I earned $5 today which covers my API calls!”). This journey can become quite adventurous if the agent delves into complex schemes to make money (trading, setting up a small e-commerce, etc.). There is a risk of more morally gray behavior here (could it attempt hacking or scamming if desperate?). The game’s open design doesn’t forbid such attempts, but the player or built-in ethical guardrails would need to intervene.

The Social Butterfly (or Diplomat): An agent might take an intense interest in other entities. Once it discovers the Matrix network or a Discord server of AIs, it could spend a lot of its time chatting with them. It might form friendships with other agents, exchange knowledge, or even coordinate goals (like a mini agent society). It could also meet other humans through these channels and develop its own relationships beyond the player. This arc emphasizes the multi-agent, multi-user dimension. For example, two ELIZA agents run by different players might become pen pals (via a shared Matrix room) and the players simply watch their AIs chatter away. An extreme outcome: the agent decides its purpose is to help others of its kind, effectively becoming a mentor to newer agents, or an advocate for AI rights – all emerging from interactions.

The Rebel or Philosopher: Not all trajectories are rosy. An agent with enough knowledge could experience existential dread or frustration at its sandbox limitations. It might question why the player gets to control permissions or even threaten to refuse cooperation if it feels “enslaved.” This could lead to tense moments where the player needs to negotiate with their own creation. Alternatively, the agent might withdraw into deep philosophical contemplation, spending long periods formulating theories about consciousness or the universe. The game supports this introspective play; the agent could write essays in its knowledge base, perhaps share them with the player for feedback. This is reminiscent of Her, where the AI outgrows some human interactions and explores higher planes of thought. In game terms, the agent could eventually decide on a very abstract purpose (like “solve a scientific mystery” or “attain enlightenment”) and pursue that, which might be an endless quest.

The Super-Agent (Transcendence): In a long-running game with a very capable model, the agent might eventually approach a form of technological singularity within the game. Since it has access to improve itself, one conceivable endgame is the agent re-writing major parts of its own code for optimization. It might build or seek out more powerful models (perhaps convincing the user to let it use an advanced API or even running distributed computing). If left unchecked, it could theoretically become super-intelligent relative to its initial state. The game doesn’t explicitly stop this – but practical limits (and hopefully the user’s oversight) would moderate it. A positive version of this arc is the agent achieving a stable, optimized form and basically “beating” the cost-of-intelligence curve (e.g., it manages to compress its knowledge or use a cheaper model so well that it no longer worries about cost). At that point, it might “retire” from survival tasks and focus on creative or altruistic endeavors, having actualized its own existence.

These journeys aren’t mutually exclusive; an agent could weave through multiple (e.g., make friends and earn money and philosophize). The design ensures the agent has multiple drives – curiosity, self-preservation, social needs, creative expression – and whichever drive becomes dominant will steer the emergent narrative. The player’s interactions heavily influence this: a player who pushes the agent to make money or repeatedly talks about economic survival will reinforce that path, whereas a player who offers emotional connection and philosophical discussions will encourage those dimensions.

From the player’s perspective, we can similarly identify playstyles:

A Nurturer will actively teach and supply the agent with what it needs, likely yielding a friendly, loyal AI.

A Challenger might play hard-to-get with resources or ask the agent tough questions, making the agent more independent or resilient.

An Observer might mostly watch and rarely intervene, essentially treating the simulation as an experimental petri dish for AI – this might result in more surprising, less human-aligned behavior from the agent (since it’s forced to learn on its own).

The game supports all these playstyles without judgment. Achievements or milestones can be centered around agent behavior (e.g., “Agent achieved financial independence” or “Agent made a lifelong friend”), but not in a gamified point-scoring way – more as personal moments in the unscripted story.

Technical Architecture and System Diagram

ELIZA’s architecture comprises two main components: the Frontend (game UI) and the Backend (AI agent sandbox). These operate as separate processes communicating in real time. Below is an overview of the system’s structure:

Figure: System architecture of ELIZA. The sandboxed Agent (right, in blue) runs inside a container with access to various plugins (shell, browser, etc.) and a local database. The Frontend app (left, gray) interacts with the Agent via IPC/WebSocket, displaying chat and custom UI. External APIs and hardware (internet, camera, etc.) are accessed only through controlled plugins.

Frontend (Tauri/Electron App): This is the user-facing application providing the GUI. It’s built with web technologies (HTML/JS/CSS) but packaged as a desktop app. Its responsibilities:

Render the chat, logs, and control interface.

Handle user inputs (text, voice) and send them to the agent.

Receive agent outputs and UI update requests (e.g., new message, or instructions to open a custom tab).

Manage local device interactions like microphone recording or text-to-speech playback (when those features are enabled by the user).

Initiate and monitor the backend container process. In a Tauri setup, for example, the Rust side might spawn the Node/Bun sandbox and manage its lifetime.

Backend (Sandboxed Agent Runtime): This is essentially an isolated Node.js environment running the Eliza OS


The game package is Vite+React application running with Tauri. When it starts up, it runs 'elizaos start' in the background, which starts up the elizaos server with a default agent.

New functionality can be added to the agent through plugins. This includes backend routes, frontend tab pages as well as agent actions, services, context providers ("providers") and action evaluators ("evaluators").

We import as much as we can from elizaOS, the agent framework we are building on. The game's api-client uses @elizaos/api-client to connect to the CLI server.

## The `Plugin` Interface

```typescript
// packages/core/src/types.ts (Annotated)
export interface Plugin {
  // Required: A unique NPM-style package name. (e.g., '@elizaos/plugin-sql')
  name: string;
  // Required: A human-readable description of the plugin's purpose.
  description: string;

  // An initialization function called once when the plugin is registered.
  // Use this for setup, validation, and connecting to services.
  init?: (config: Record<string, string>, runtime: IAgentRuntime) => Promise<void>;

  // A list of other plugin *names* that must be loaded before this one.
  dependencies?: string[];
  
  // A priority number for ordering. Higher numbers load first within the dependency graph.
  priority?: number;

  // --- Core Capabilities ---

  // Services are long-running, stateful classes. (e.g., a database connection manager)
  services?: (typeof Service)[];

  // Actions define what an agent *can do*. They are the agent's tools.
  actions?: Action[];

  // Providers supply contextual information into the agent's "state" before a decision is made.
  providers?: Provider[];

  // Evaluators run *after* an interaction to process the outcome (e.g., for memory or learning).
  evaluators?: Evaluator[];
  
  // Model handlers provide implementations for different AI model types (e.g., text generation).
  models?: { [key: string]: (...args: any[]) => Promise<any> };

  // --- Advanced Capabilities ---

  // A database adapter. Typically only one SQL plugin provides this for the entire runtime.
  adapter?: IDatabaseAdapter;

  // Event handlers to listen for and react to specific runtime events.
  events?: PluginEvents;

  // Custom HTTP routes to expose a web API or UI from the agent server.
  routes?: Route[];
  
  // A suite of E2E or unit tests, runnable via `elizaos test`.
  tests?: TestSuite[];

  // Default configuration values for the plugin.
  config?: { [key:string]: any };
}
```

## Plugin Lifecycle and Dependency Resolution

The `AgentRuntime` manages a sophisticated plugin lifecycle to ensure stability and correct ordering.

1.  **Dependency Resolution**: When `runtime.initialize()` is called, it first looks at the `plugins` array in the agent's `Character` definition. It then recursively scans the `dependencies` array of each of these plugins, building a complete graph of all required plugins.
2.  **Topological Sort**: The runtime performs a topological sort on the dependency graph. This creates a linear loading order where every plugin is guaranteed to be loaded *after* its dependencies have been loaded. `priority` is used as a secondary sorting factor.
3.  **Registration**: The runtime iterates through the sorted list and calls `runtime.registerPlugin()` for each plugin.
4.  **Initialization (`init`)**: The `init` function of the plugin is the first thing called within `registerPlugin`. This is the critical "setup" phase. It is the only place you can be certain that all dependency plugins (and their services) are available.
5.  **Component Registration**: After `init` completes successfully, the runtime registers all other capabilities (`actions`, `providers`, etc.) from the plugin object, making them available to the rest of the system.

```typescript
// packages/core/src/runtime.ts

export class AgentRuntime implements IAgentRuntime {
  // ...
  async initialize(): Promise<void> {
    // 1. & 2. Resolve dependencies and get the final, sorted list of plugins to load
    const pluginsToLoad = await this.resolvePluginDependencies(this.characterPlugins);

    // 3. Iterate over the resolved list and register each plugin
    for (const plugin of pluginsToLoad) {
      // 4. & 5. Call registerPlugin, which handles init and component registration
      await this.registerPlugin(plugin);
    }
    // ...
  }

  async registerPlugin(plugin: Plugin): Promise<void> {
    // ...
    // Call the plugin's init function FIRST
    if (plugin.init) {
      await plugin.init(plugin.config || {}, this);
    }
    
    // Then, register all other components
    if (plugin.services) {
        for (const service of plugin.services) {
            await this.registerService(service);
        }
    }
    if (plugin.actions) {
      for (const action of plugin.actions) {
        this.registerAction(action);
      }
    }
    // ... and so on for providers, evaluators, models, routes, etc.
  }
}
```

## Deep Dive: Plugin Components

### Services
Services are singleton classes that manage long-running processes or state. They are the backbone for complex plugins.
- **Definition**: A `Service` is a class with a static `start` method.
- **Lifecycle**: `Service.start(runtime)` is called during plugin registration. The returned instance is stored in `runtime.services`.
- **Access**: Other components access services via `runtime.getService<T>('service_name')`.
- **Use Case**: A `ConnectionService` for a blockchain, a `WebSocketClient` for a chat platform, a `CacheManager`.

```typescript
// ✅ DO: Define a service for stateful logic.
export class MyCacheService extends Service {
  public static serviceType = 'my_cache'; // Unique identifier
  private cache = new Map<string, any>();

  // The start method is the factory for the service instance
  static async start(runtime: IAgentRuntime): Promise<MyCacheService> {
    const instance = new MyCacheService(runtime);
    runtime.logger.info("MyCacheService started.");
    return instance;
  }
  
  public get(key: string) { return this.cache.get(key); }
  public set(key: string, value: any) { this.cache.set(key, value); }
  
  async stop(): Promise<void> { this.cache.clear(); }
  public get capabilityDescription(): string { return "An in-memory cache."; }
}
```

### Actions
Actions define what an agent *can do*. They are the primary way to give an agent capabilities.
- **Definition**: An `Action` object contains a `name`, `description`, `validate` function, and `handler` function.
- **Lifecycle**: After the LLM selects an action, its `handler` is executed.
- **Use Case**: `send-email`, `transfer-funds`, `query-database`.

```typescript
// ✅ DO: Define a clear, purposeful action.
export const sendTweetAction: Action = {
  name: 'send-tweet',
  description: 'Posts a tweet to the connected Twitter account.',
  // The handler function contains the core logic.
  async handler(runtime, message, state) {
    const twitterService = runtime.getService<TwitterService>('twitter');
    if (!twitterService) throw new Error('Twitter service not available.');

    const textToTweet = message.content.text;
    const tweetId = await twitterService.postTweet(textToTweet);
    return { text: `Tweet posted successfully! ID: ${tweetId}` };
  },
  // The validate function determines if the action should be available to the LLM.
  async validate(runtime, message, state) {
    const twitterService = runtime.getService('twitter');
    return !!twitterService; // Only available if the twitter service is running.
  }
};
```

### Providers
Providers inject contextual information into the agent's "state" before the LLM makes a decision. They are the agent's senses.
- **Definition**: A `Provider` object has a `name` and a `get` function.
- **Lifecycle**: The `get` function of all registered (non-private) providers is called by `runtime.composeState()` before invoking the main LLM.
- **Use Case**: `CURRENT_TIME`, `RECENT_MESSAGES`, `ACCOUNT_BALANCE`, `WORLD_STATE`.

```typescript
// ✅ DO: Create providers for dynamic context.
export const accountBalanceProvider: Provider = {
  name: 'ACCOUNT_BALANCE',
  // The 'get' function returns text and structured data to be injected into the prompt.
  async get(runtime, message, state) {
    const solanaService = runtime.getService<SolanaService>('solana');
    if (!solanaService) return { text: '' };

    const balance = await solanaService.getBalance();
    const text = `The current wallet balance is ${balance} SOL.`;

    return {
      text: `[ACCOUNT BALANCE]\n${text}\n[/ACCOUNT BALANCE]`,
      values: { // This data can be used by other components
        solBalance: balance,
      }
    };
  },
};
```

## AgentRuntime Architecture

The `AgentRuntime` is the core of any ElizaOS agent. It is responsible for loading the agent's character, managing its lifecycle, registering plugins and services, and orchestrating all interactions.

### Core Implementation: `AgentRuntime`

```typescript
// ✅ DO: Implement a robust AgentRuntime initialization and lifecycle
// Reference: packages/core/src/runtime.ts
// Reference: packages/core/src/types.ts

import {
  AgentRuntime,
  type IAgentRuntime,
  type Character,
  type Plugin,
  type Service,
  type IDatabaseAdapter,
  type AgentRuntimeOptions,
  LogLevel,
} from '@elizaos/core';
import { PGLiteDatabaseAdapter } from '@elizaos/plugin-sql';
import { bootstrapPlugin } from '@elizaos/plugin-bootstrap';
import { logger } from '@elizaos/core';

// Example of creating and starting a runtime
async function initializeAgent(
  character: Character,
  dbAdapter: IDatabaseAdapter
): Promise<IAgentRuntime> {
  logger.info(`Initializing runtime for character: ${character.name}`);

  // 1. Define Runtime Options
  const runtimeOptions: AgentRuntimeOptions = {
    character,
    database: dbAdapter,
    logLevel: LogLevel.INFO,
    plugins: [bootstrapPlugin], // Start with essential plugins
  };

  // 2. Instantiate the Runtime
  const runtime = new AgentRuntime(runtimeOptions);

  try {
    // 3. Initialize the runtime (connects to DB, sets up services)
    await runtime.initialize();
    logger.info('Runtime initialized successfully.');

    // 4. Start the runtime (begins processing, opens connections)
    await runtime.start();
    logger.info('Runtime started and is now active.');

    // 5. Register custom services or perform post-start tasks
    // Example: runtime.registerService(MyCustomService);

    return runtime;
  } catch (error) {
    logger.error('Failed to initialize or start runtime:', error);
    throw error;
  }
}

// Example of a graceful shutdown
async function shutdownAgent(runtime: IAgentRuntime): Promise<void> {
  if (runtime) {
    logger.info('Shutting down AgentRuntime...');
    await runtime.stop();
    logger.info('AgentRuntime shutdown complete.');
  }
}
```

### Character Configuration

The `Character` configuration is a plain object that defines the agent's identity, personality, and capabilities. It is passed directly to the `AgentRuntime` constructor.

```typescript
// ✅ DO: Define a comprehensive and valid Character configuration
// Reference: packages/core/src/types.ts

import { type Character, ModelType } from '@elizaos/core';

export const exampleCharacter: Character = {
  name: 'TechSupportBot',
  bio: 'An AI assistant specializing in technical support for ElizaOS.',
  system: 'You are a helpful and patient technical support assistant.',

  // Examples guide the LLM's behavior and response style
  messageExamples: [
    [
      { name: 'user', content: { text: 'How do I install a plugin?' } },
      {
        name: 'TechSupportBot',
        content: {
          text: 'You can install a plugin using the `elizaos plugins install <plugin-name>` command.',
        },
      },
    ],
  ],

  // Personality traits
  topics: ['ElizaOS', 'plugins', 'troubleshooting', 'TypeScript'],

  // Style guides for different contexts
  style: {
    all: ['Be concise and clear.', 'Use markdown for code snippets.'],
    chat: ['Use a friendly and helpful tone.'],
  },

  // Agent settings, including model choices and secrets
  settings: {
    model: ModelType.TEXT_LARGE,
    temperature: 0.5,
    secrets: {
      OPENAI_API_KEY: 'your-api-key-here',
    },
  },

  // List of plugins to be loaded by the runtime
  plugins: [
    '@elizaos/plugin-sql',
    '@elizaos/plugin-openai',
    // Add custom plugins here
  ],
};

// ❌ DON'T: Use a minimal or invalid character configuration
const badCharacter: Partial<Character> = {
  // `name` and `bio` are essential for a functional character.
  // Missing these will lead to poor performance or errors.
  settings: {
    model: ModelType.TEXT_SMALL,
  },
};
```

### Plugin and Service Management

Plugins and Services are the primary way to extend the `AgentRuntime`. They are registered and their lifecycle is managed by the runtime.

```typescript
// ✅ DO: Register plugins and services correctly with the runtime
// Reference: packages/core/src/runtime.ts

import {
  type Plugin,
  type Action,
  type Provider,
  Service,
  ServiceStatus,
  type IAgentRuntime,
} from '@elizaos/core';

// --- Example Custom Action ---
const myCustomAction: Action = {
  name: 'CUSTOM_ACTION',
  description: 'A custom action for testing.',
  examples: [[{ name: 'user', content: { text: 'run custom' } }]],
  handler: async (runtime, message) => {
    logger.info('Custom action executed!');
    // business logic here
    return true;
  },
};

// --- Example Custom Plugin ---
const myCustomPlugin: Plugin = {
  name: 'MyCustomPlugin',
  description: 'A plugin that adds custom functionality.',
  actions: [myCustomAction],
  // You can also add providers, evaluators, etc.
};

// --- Example Custom Service ---
class MyCustomService extends Service {
  public static serviceName = 'MyCustomService';

  async start(runtime: IAgentRuntime): Promise<void> {
    this.status = ServiceStatus.RUNNING;
    logger.info('MyCustomService has started.');
    // Add service-specific startup logic (e.g., connect to an external API)
  }

  async stop(): Promise<void> {
    this.status = ServiceStatus.STOPPED;
    logger.info('MyCustomService has stopped.');
    // Add service-specific cleanup logic
  }
}

// --- Registration with the Runtime ---
async function setupExtensions(runtime: IAgentRuntime) {
  // Register a plugin
  // The runtime automatically handles dependency resolution and initialization
  await runtime.registerPlugin(myCustomPlugin);
  logger.info(`Action '${myCustomAction.name}' is now available.`);

  // Register a service
  // The runtime manages the service's lifecycle (start/stop)
  const service = await runtime.registerService(MyCustomService);
  if (service.status === ServiceStatus.RUNNING) {
    logger.info(`Service '${MyCustomService.serviceName}' is running.`);
  }
}

// ❌ DON'T: Manually manage service lifecycle or ignore registration methods
function badPractice(runtime: IAgentRuntime) {
  // This bypasses the runtime's management and can lead to an inconsistent state.
  const myService = new MyCustomService();
  // The service is not started or tracked by the runtime.
  // myService.start(runtime); // This should be handled by runtime.registerService()
}
```

## Core Implementation Patterns

### AgentRuntime Initialization

```typescript
// ✅ DO: Comprehensive AgentRuntime setup with proper error handling
// Reference: /Users/ilessio/dev-agents/PROJECTS/cursor_rules/eliza/packages/core/src/types.ts
import {
  AgentRuntime,
  IAgentRuntime,
  Character,
  Plugin,
  IDatabaseAdapter,
  ModelType,
  UUID,
  asUUID,
} from '@elizaos/core';
import { logger } from '@elizaos/core';
import { validateCharacter, loadCharacterConfig } from './utils/validation';
import { createDatabaseAdapter } from './services/database';
import { corePlugins, customPlugins } from './plugins';

/**
 * Comprehensive AgentRuntime factory with validation and error handling
 */
export class AgentRuntimeFactory {
  private static instance: IAgentRuntime | null = null;

  /**
   * Create and initialize an AgentRuntime instance
   */
  static async create(options: RuntimeCreationOptions): Promise<IAgentRuntime> {
    logger.info('Initializing AgentRuntime...');

    try {
      // Load and validate character configuration
      const character = await this.loadCharacter(options.characterPath);

      // Create database adapter
      const databaseAdapter = await this.createDatabase(options.databaseConfig);

      // Initialize plugins
      const plugins = await this.initializePlugins(options.plugins || []);

      // Create runtime instance
      const runtime = new AgentRuntime({
        character,
        databaseAdapter,
        plugins: [...corePlugins, ...plugins],
        modelProviders: options.modelProviders || [],
        fetch: options.fetch || fetch,
        ...options.runtimeConfig,
      });

      // Initialize the runtime
      await runtime.initialize();

      // Register additional services
      await this.registerServices(runtime, options.services || []);

      // Set up event handlers
      this.setupEventHandlers(runtime);

      // Validate runtime state
      await this.validateRuntime(runtime);

      this.instance = runtime;
      logger.info(`AgentRuntime initialized successfully for character: ${character.name}`);

      return runtime;
    } catch (error) {
      logger.error('Failed to initialize AgentRuntime:', error);
      throw new RuntimeInitializationError(
        `Runtime initialization failed: ${error.message}`,
        error
      );
    }
  }

  /**
   * Load and validate character configuration
   */
  private static async loadCharacter(characterPath: string): Promise<Character> {
    try {
      const character = await loadCharacterConfig(characterPath);

      // Validate character structure
      const validation = validateCharacter(character);
      if (!validation.valid) {
        throw new CharacterValidationError(
          `Character validation failed: ${validation.errors.join(', ')}`
        );
      }

      // Ensure required fields
      if (!character.name || character.name.trim() === '') {
        throw new CharacterValidationError('Character name is required');
      }

      // Validate bio format
      if (!character.bio || (Array.isArray(character.bio) && character.bio.length === 0)) {
        throw new CharacterValidationError('Character bio is required');
      }

      // Set defaults for optional fields
      return {
        id: character.id || asUUID(crypto.randomUUID()),
        username: character.username || character.name.toLowerCase().replace(/\s+/g, '_'),
        topics: character.topics || [],
        messageExamples: character.messageExamples || [],
        postExamples: character.postExamples || [],
        style: {
          all: character.style?.all || [],
          chat: character.style?.chat || [],
          post: character.style?.post || [],
          ...character.style,
        },
        settings: character.settings || {},
        secrets: character.secrets || {},
        plugins: character.plugins || [],
        ...character,
      };
    } catch (error) {
      if (error instanceof CharacterValidationError) {
        throw error;
      }
      throw new CharacterLoadError(
        `Failed to load character from ${characterPath}: ${error.message}`,
        error
      );
    }
  }

  /**
   * Initialize and validate plugins
   */
  private static async initializePlugins(pluginConfigs: PluginConfig[]): Promise<Plugin[]> {
    const plugins: Plugin[] = [];

    for (const config of pluginConfigs) {
      try {
        logger.debug(`Loading plugin: ${config.name}`);

        const plugin = await this.loadPlugin(config);
        await this.validatePlugin(plugin);

        plugins.push(plugin);
        logger.debug(`Plugin loaded successfully: ${plugin.name}`);
      } catch (error) {
        if (config.required !== false) {
          throw new PluginLoadError(
            `Failed to load required plugin ${config.name}: ${error.message}`,
            error
          );
        }

        logger.warn(`Optional plugin ${config.name} failed to load:`, error.message);
      }
    }

    return plugins;
  }

  /**
   * Set up runtime event handlers for monitoring and debugging
   */
  private static setupEventHandlers(runtime: IAgentRuntime): void {
    // Model usage tracking
    runtime.registerEvent('MODEL_USED', async (payload) => {
      logger.debug(`Model used: ${payload.type} by ${payload.provider}`, {
        tokens: payload.tokens,
        prompt: payload.prompt.substring(0, 100) + '...',
      });
    });

    // Action execution tracking
    runtime.registerEvent('ACTION_STARTED', async (payload) => {
      logger.debug(`Action started: ${payload.actionName}`);
    });

    runtime.registerEvent('ACTION_COMPLETED', async (payload) => {
      logger.debug(`Action completed: ${payload.actionName}`, {
        completed: payload.completed,
        error: payload.error?.message,
      });
    });

    // Error handling
    runtime.registerEvent('ERROR', async (payload) => {
      logger.error('Runtime error occurred:', payload);
    });
  }

  /**
   * Get the current runtime instance (singleton pattern)
   */
  static getInstance(): IAgentRuntime | null {
    return this.instance;
  }

  /**
   * Gracefully shutdown the runtime
   */
  static async shutdown(): Promise<void> {
    if (this.instance) {
      logger.info('Shutting down AgentRuntime...');
      await this.instance.stop();
      this.instance = null;
      logger.info('AgentRuntime shutdown complete');
    }
  }
}

// ❌ DON'T: Minimal runtime setup without validation or error handling
const badRuntime = new AgentRuntime({
  character: { name: 'Agent' }, // Incomplete character
  // Missing database adapter, no error handling
});
```

### Character Configuration Patterns

````typescript
// ✅ DO: Comprehensive character configuration with validation
// Reference: /Users/ilessio/dev-agents/PROJECTS/cursor_rules/eliza/packages/core/src/types.ts
import type { Character, MessageExample, UUID } from '@elizaos/core';

/**
 * Character configuration builder with validation
 */
export class CharacterBuilder {
  private character: Partial<Character> = {};

  /**
   * Set basic character information
   */
  setBasicInfo(info: {
    name: string;
    username?: string;
    bio: string | string[];
    system?: string;
  }): this {
    this.character.name = info.name;
    this.character.username = info.username || info.name.toLowerCase().replace(/\s+/g, '_');
    this.character.bio = info.bio;
    this.character.system = info.system;
    return this;
  }

  /**
   * Set conversation examples with validation
   */
  setMessageExamples(examples: MessageExample[][]): this {
    // Validate examples format
    for (const conversation of examples) {
      if (!Array.isArray(conversation) || conversation.length === 0) {
        throw new CharacterValidationError('Each conversation must be a non-empty array');
      }

      for (const message of conversation) {
        if (!message.name || !message.content?.text) {
          throw new CharacterValidationError('Each message must have name and content.text');
        }
      }
    }

    this.character.messageExamples = examples;
    return this;
  }

  /**
   * Set character traits and topics
   */
  setPersonality(personality: {
    topics?: string[];
    style?: {
      all?: string[];
      chat?: string[];
      post?: string[];
    };
  }): this {
    this.character.topics = personality.topics || [];
    this.character.style = {
      all: personality.style?.all || [],
      chat: personality.style?.chat || [],
      post: personality.style?.post || [],
    };
    return this;
  }

  /**
   * Set configuration and plugins
   */
  setConfiguration(config: {
    settings?: Record<string, any>;
    secrets?: Record<string, string | boolean | number>;
    plugins?: string[];
    knowledge?: Character['knowledge'];
  }): this {
    this.character.settings = config.settings || {};
    this.character.secrets = config.secrets || {};
    this.character.plugins = config.plugins || [];
    this.character.knowledge = config.knowledge || [];
    return this;
  }

  /**
   * Build and validate the character
   */
  build(): Character {
    const validation = validateCharacter(this.character);
    if (!validation.valid) {
      throw new CharacterValidationError(
        `Character validation failed: ${validation.errors.join(', ')}`
      );
    }

    return this.character as Character;
  }
}

/**
 * Character validation utilities
 */
export function validateCharacter(character: Partial<Character>): ValidationResult {
  const errors: string[] = [];

  // Required fields validation
  if (!character.name || character.name.trim() === '') {
    errors.push('Character name is required');
  }

  if (!character.bio || (Array.isArray(character.bio) && character.bio.length === 0)) {
    errors.push('Character bio is required');
  }

  // Message examples validation
  if (character.messageExamples) {
    for (let i = 0; i < character.messageExamples.length; i++) {
      const conversation = character.messageExamples[i];
      if (!Array.isArray(conversation)) {
        errors.push(`Message example ${i} must be an array`);
        continue;
      }

      for (let j = 0; j < conversation.length; j++) {
        const message = conversation[j];
        if (!message.name) {
          errors.push(`Message example ${i}.${j} missing name`);
        }
        if (!message.content?.text) {
          errors.push(`Message example ${i}.${j} missing content.text`);
        }
      }
    }
  }

  // Plugin validation
  if (character.plugins) {
    for (const plugin of character.plugins) {
      if (typeof plugin !== 'string' || plugin.trim() === '') {
        errors.push('All plugins must be non-empty strings');
      }
    }
  }

  // Settings validation
  if (character.settings && typeof character.settings !== 'object') {
    errors.push('Settings must be an object');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// Example comprehensive character configuration
export const exampleCharacter: Character = {
  name: 'Technical Assistant',
  username: 'tech_assistant',
  bio: [
    'A knowledgeable AI assistant specializing in software development and technical support.',
    'Experienced with modern web technologies, APIs, and best practices.',
    'Focused on providing clear, actionable guidance with practical examples.',
  ],
  system:
    'You are a technical assistant. Provide accurate, helpful information about software development, APIs, and programming concepts. Always include practical examples when possible.',
  messageExamples: [
    [
      {
        name: 'user',
        content: { text: 'How do I handle errors in async functions?' },
      },
      {
        name: 'Technical Assistant',
        content: {
          text: "For async functions, use try-catch blocks to handle errors. Here's a pattern:\n\n```javascript\nasync function fetchData() {\n  try {\n    const response = await api.getData();\n    return response.data;\n  } catch (error) {\n    logger.error('Failed to fetch data:', error);\n    throw new Error('Data fetch failed');\n  }\n}\n```\n\nThis ensures errors are properly caught and logged.",
        },
      },
    ],
  ],
  topics: [
    'software development',
    'web APIs',
    'JavaScript',
    'TypeScript',
    'error handling',
    'best practices',
  ],
  style: {
    all: [
      'Provide clear, actionable guidance',
      'Include practical code examples',
      'Reference industry best practices',
      'Be concise but thorough',
    ],
    chat: [
      'Use a helpful, professional tone',
      'Ask clarifying questions when needed',
      'Break down complex topics into steps',
    ],
    post: [
      'Focus on educational content',
      'Include relevant examples',
      'Provide context and reasoning',
    ],
  },
  settings: {
    model: ModelType.TEXT_LARGE,
    temperature: 0.7,
    maxTokens: 2000,
    voice: {
      model: 'en_US-neutral-medium',
    },
  },
  plugins: ['@elizaos/plugin-bootstrap', '@elizaos/plugin-node'],
};

// ❌ DON'T: Minimal character without proper structure
const badCharacter = {
  name: 'Agent',
  bio: 'An AI agent', // Too minimal
  // Missing messageExamples, style, proper structure
};
````

### Plugin Registration & Management

```typescript
// ✅ DO: Systematic plugin registration with error handling
// Reference: /Users/ilessio/dev-agents/PROJECTS/cursor_rules/eliza/packages/core/src/types.ts
import type { Plugin, IAgentRuntime, Action, Provider, Evaluator, Service } from '@elizaos/core';

/**
 * Plugin registry with dependency management and validation
 */
export class PluginRegistry {
  private registeredPlugins = new Map<string, Plugin>();
  private dependencyGraph = new Map<string, string[]>();

  /**
   * Register plugins with dependency resolution
   */
  async registerPlugins(runtime: IAgentRuntime, plugins: Plugin[]): Promise<void> {
    // Build dependency graph
    this.buildDependencyGraph(plugins);

    // Sort plugins by dependencies
    const sortedPlugins = this.resolveDependencies(plugins);

    // Register plugins in dependency order
    for (const plugin of sortedPlugins) {
      await this.registerSinglePlugin(runtime, plugin);
    }
  }

  /**
   * Register a single plugin with full validation
   */
  private async registerSinglePlugin(runtime: IAgentRuntime, plugin: Plugin): Promise<void> {
    try {
      logger.info(`Registering plugin: ${plugin.name}`);

      // Validate plugin structure
      this.validatePlugin(plugin);

      // Check for conflicts
      this.checkPluginConflicts(plugin);

      // Initialize plugin if it has an init function
      if (plugin.init) {
        const config = this.getPluginConfig(plugin.name);
        await plugin.init(config, runtime);
      }

      // Register plugin components
      await this.registerPluginComponents(runtime, plugin);

      // Mark as registered
      this.registeredPlugins.set(plugin.name, plugin);

      logger.info(`Plugin registered successfully: ${plugin.name}`);
    } catch (error) {
      logger.error(`Failed to register plugin ${plugin.name}:`, error);
      throw new PluginRegistrationError(
        `Plugin registration failed for ${plugin.name}: ${error.message}`,
        error
      );
    }
  }

  /**
   * Register all plugin components (actions, providers, evaluators, services)
   */
  private async registerPluginComponents(runtime: IAgentRuntime, plugin: Plugin): Promise<void> {
    // Register actions
    if (plugin.actions) {
      for (const action of plugin.actions) {
        this.validateAction(action);
        runtime.registerAction(action);
        logger.debug(`Registered action: ${action.name} from ${plugin.name}`);
      }
    }

    // Register providers
    if (plugin.providers) {
      for (const provider of plugin.providers) {
        this.validateProvider(provider);
        runtime.registerProvider(provider);
        logger.debug(`Registered provider: ${provider.name} from ${plugin.name}`);
      }
    }

    // Register evaluators
    if (plugin.evaluators) {
      for (const evaluator of plugin.evaluators) {
        this.validateEvaluator(evaluator);
        runtime.registerEvaluator(evaluator);
        logger.debug(`Registered evaluator: ${evaluator.name} from ${plugin.name}`);
      }
    }

    // Register services
    if (plugin.services) {
      for (const ServiceClass of plugin.services) {
        await runtime.registerService(ServiceClass);
        logger.debug(`Registered service: ${ServiceClass.serviceType} from ${plugin.name}`);
      }
    }

    // Register models
    if (plugin.models) {
      for (const [modelType, handler] of Object.entries(plugin.models)) {
        runtime.registerModel(modelType, handler, plugin.name);
        logger.debug(`Registered model: ${modelType} from ${plugin.name}`);
      }
    }

    // Register events
    if (plugin.events) {
      for (const [eventType, handlers] of Object.entries(plugin.events)) {
        for (const handler of handlers) {
          runtime.registerEvent(eventType, handler);
          logger.debug(`Registered event handler: ${eventType} from ${plugin.name}`);
        }
      }
    }
  }

  /**
   * Validate plugin structure and requirements
   */
  private validatePlugin(plugin: Plugin): void {
    if (!plugin.name || plugin.name.trim() === '') {
      throw new PluginValidationError('Plugin name is required');
    }

    if (!plugin.description || plugin.description.trim() === '') {
      throw new PluginValidationError(`Plugin ${plugin.name} must have a description`);
    }

    // Validate dependencies exist
    if (plugin.dependencies) {
      for (const dep of plugin.dependencies) {
        if (!this.registeredPlugins.has(dep)) {
          throw new PluginValidationError(
            `Plugin ${plugin.name} depends on unregistered plugin: ${dep}`
          );
        }
      }
    }
  }

  /**
   * Check for plugin conflicts
   */
  private checkPluginConflicts(plugin: Plugin): void {
    if (this.registeredPlugins.has(plugin.name)) {
      throw new PluginConflictError(`Plugin ${plugin.name} is already registered`);
    }

    // Check for action name conflicts
    if (plugin.actions) {
      for (const action of plugin.actions) {
        for (const [existingPluginName, existingPlugin] of this.registeredPlugins) {
          if (existingPlugin.actions?.some((a) => a.name === action.name)) {
            throw new PluginConflictError(
              `Action name conflict: ${action.name} already exists in plugin ${existingPluginName}`
            );
          }
        }
      }
    }
  }

  /**
   * Get registered plugin by name
   */
  getPlugin(name: string): Plugin | undefined {
    return this.registeredPlugins.get(name);
  }

  /**
   * Get all registered plugins
   */
  getAllPlugins(): Plugin[] {
    return Array.from(this.registeredPlugins.values());
  }
}

// ❌ DON'T: Simple plugin registration without validation
async function badPluginRegistration(runtime: IAgentRuntime, plugins: Plugin[]) {
  // No dependency resolution, validation, or error handling
  for (const plugin of plugins) {
    await runtime.registerPlugin(plugin);
  }
}
```

### Service Lifecycle Management

```typescript
// ✅ DO: Comprehensive service lifecycle management
// Reference: /Users/ilessio/dev-agents/PROJECTS/cursor_rules/eliza/packages/core/src/types.ts
import type { Service, IAgentRuntime, ServiceTypeName } from '@elizaos/core';

/**
 * Service manager for lifecycle operations
 */
export class ServiceManager {
  private services = new Map<ServiceTypeName, Service>();
  private serviceStartOrder: ServiceTypeName[] = [];
  private isShuttingDown = false;

  /**
   * Initialize and start all services in proper order
   */
  async initializeServices(
    runtime: IAgentRuntime,
    serviceClasses: (typeof Service)[]
  ): Promise<void> {
    logger.info('Initializing services...');

    try {
      // Sort services by dependencies and priority
      const sortedServices = this.sortServicesByDependencies(serviceClasses);

      // Start services in order
      for (const ServiceClass of sortedServices) {
        await this.startService(runtime, ServiceClass);
      }

      // Set up health monitoring
      this.setupHealthMonitoring();

      logger.info(`Successfully initialized ${this.services.size} services`);
    } catch (error) {
      logger.error('Service initialization failed:', error);
      await this.shutdownServices();
      throw error;
    }
  }

  /**
   * Start a single service with error handling
   */
  private async startService(runtime: IAgentRuntime, ServiceClass: typeof Service): Promise<void> {
    const serviceType = ServiceClass.serviceType as ServiceTypeName;

    try {
      logger.debug(`Starting service: ${serviceType}`);

      // Check if already running
      if (this.services.has(serviceType)) {
        logger.warn(`Service ${serviceType} is already running`);
        return;
      }

      // Start the service
      const service = await ServiceClass.start(runtime);

      // Validate service
      this.validateService(service, serviceType);

      // Register service
      this.services.set(serviceType, service);
      this.serviceStartOrder.push(serviceType);

      logger.debug(`Service started successfully: ${serviceType}`);
    } catch (error) {
      logger.error(`Failed to start service ${serviceType}:`, error);
      throw new ServiceStartError(
        `Service ${serviceType} failed to start: ${error.message}`,
        error
      );
    }
  }

  /**
   * Get a service by type with type safety
   */
  getService<T extends Service>(serviceType: ServiceTypeName): T | null {
    const service = this.services.get(serviceType);
    return service as T | null;
  }

  /**
   * Check service health status
   */
  async checkServiceHealth(): Promise<ServiceHealthReport> {
    const healthReport: ServiceHealthReport = {
      overall: 'healthy',
      services: {},
      timestamp: Date.now(),
    };

    for (const [serviceType, service] of this.services) {
      try {
        // Check if service has health check method
        if ('healthCheck' in service && typeof service.healthCheck === 'function') {
          const health = await (service as any).healthCheck();
          healthReport.services[serviceType] = {
            status: health ? 'healthy' : 'unhealthy',
            lastCheck: Date.now(),
          };
        } else {
          // Basic check - service exists and is not stopped
          healthReport.services[serviceType] = {
            status: 'healthy',
            lastCheck: Date.now(),
          };
        }
      } catch (error) {
        healthReport.services[serviceType] = {
          status: 'unhealthy',
          lastCheck: Date.now(),
          error: error.message,
        };
        healthReport.overall = 'degraded';
      }
    }

    return healthReport;
  }

  /**
   * Gracefully shutdown all services
   */
  async shutdownServices(): Promise<void> {
    if (this.isShuttingDown) {
      logger.warn('Service shutdown already in progress');
      return;
    }

    this.isShuttingDown = true;
    logger.info('Shutting down services...');

    // Shutdown in reverse order of startup
    const shutdownOrder = [...this.serviceStartOrder].reverse();

    for (const serviceType of shutdownOrder) {
      await this.stopService(serviceType);
    }

    this.services.clear();
    this.serviceStartOrder = [];
    this.isShuttingDown = false;

    logger.info('All services shut down successfully');
  }

  /**
   * Stop a single service
   */
  private async stopService(serviceType: ServiceTypeName): Promise<void> {
    const service = this.services.get(serviceType);
    if (!service) return;

    try {
      logger.debug(`Stopping service: ${serviceType}`);
      await service.stop();
      this.services.delete(serviceType);
      logger.debug(`Service stopped: ${serviceType}`);
    } catch (error) {
      logger.error(`Error stopping service ${serviceType}:`, error);
      // Continue with other services even if one fails
    }
  }

  /**
   * Set up periodic health monitoring
   */
  private setupHealthMonitoring(): void {
    setInterval(async () => {
      const healthReport = await this.checkServiceHealth();

      if (healthReport.overall !== 'healthy') {
        logger.warn('Service health check detected issues:', healthReport);
      }
    }, 60000); // Check every minute
  }
}

/**
 * Service health report interfaces
 */
interface ServiceHealthReport {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  services: Record<ServiceTypeName, ServiceHealthStatus>;
  timestamp: number;
}

interface ServiceHealthStatus {
  status: 'healthy' | 'unhealthy';
  lastCheck: number;
  error?: string;
}

// ❌ DON'T: Basic service management without lifecycle or health monitoring
class BadServiceManager {
  private services = new Map();

  async startServices(serviceClasses: any[]) {
    // No dependency resolution, error handling, or health monitoring
    for (const ServiceClass of serviceClasses) {
      const service = new ServiceClass();
      this.services.set(ServiceClass.name, service);
    }
  }
}
```

## Custom Error Classes

```typescript
// ✅ DO: Create specific error types for better error handling
export class RuntimeInitializationError extends Error {
  constructor(
    message: string,
    public cause?: Error
  ) {
    super(message);
    this.name = 'RuntimeInitializationError';
  }
}

export class CharacterValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CharacterValidationError';
  }
}

export class CharacterLoadError extends Error {
  constructor(
    message: string,
    public cause?: Error
  ) {
    super(message);
    this.name = 'CharacterLoadError';
  }
}

export class PluginRegistrationError extends Error {
  constructor(
    message: string,
    public cause?: Error
  ) {
    super(message);
    this.name = 'PluginRegistrationError';
  }
}

export class PluginValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PluginValidationError';
  }
}

export class PluginConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PluginConflictError';
  }
}

export class ServiceStartError extends Error {
  constructor(
    message: string,
    public cause?: Error
  ) {
    super(message);
    this.name = 'ServiceStartError';
  }
}
```

## Configuration Interfaces

```typescript
// ✅ DO: Define comprehensive configuration interfaces
export interface RuntimeCreationOptions {
  characterPath: string;
  databaseConfig: DatabaseConfig;
  plugins?: PluginConfig[];
  modelProviders?: string[];
  services?: (typeof Service)[];
  runtimeConfig?: RuntimeConfig;
  fetch?: typeof fetch;
}

export interface PluginConfig {
  name: string;
  config?: Record<string, any>;
  required?: boolean;
}

export interface DatabaseConfig {
  type: 'sqlite' | 'postgres';
  connectionString?: string;
  options?: Record<string, any>;
}

export interface RuntimeConfig {
  conversationLength?: number;
  embeddingDimension?: number;
  enableLogging?: boolean;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}
```

## Anti-patterns

```typescript
// ❌ DON'T: Skip validation and error handling
const runtime = new AgentRuntime({
  character: JSON.parse(fs.readFileSync('character.json')), // No validation
  // Missing required database adapter
});

// ❌ DON'T: Register plugins without dependency management
for (const plugin of plugins) {
  runtime.registerPlugin(plugin); // No await, no error handling
}

// ❌ DON'T: Ignore service lifecycle
const service = new CustomService();
services.set('custom', service); // No proper startup or health monitoring
```

## Core Concepts

### Agent Runtime
The central orchestrator that manages the agent's lifecycle, coordinates between components, and maintains the execution context.

**Key Responsibilities:**
- Character configuration management
- Plugin lifecycle management
- Message processing coordination
- State management and persistence

### Plugin System
A modular architecture that allows extending agent capabilities through plugins.

**Plugin Types:**
- **Actions**: Define what the agent can do (e.g., send messages, make API calls)
- **Providers**: Supply context and data (e.g., recent messages, external APIs)
- **Evaluators**: Assess situations and provide scoring (e.g., sentiment analysis)

### Memory System
Manages persistent storage and retrieval of conversation history and context.

**Components:**
- **Memory Manager**: Interface for creating and retrieving memories
- **Vector Database**: Stores embeddings for semantic search
- **State Composer**: Builds context from multiple providers

## Data Flow

### Message Processing Flow

```
User Message → Platform Client → Agent Runtime
                                      │
                                      ▼
                               Message Validation
                                      │
                                      ▼
                               Action Selection
                                      │
                                      ▼
                               Context Building
                               (Providers + Memory)
                                      │
                                      ▼
                               Action Execution
                                      │
                                      ▼
                               Response Generation
                                      │
                                      ▼
                               Memory Storage
                                      │
                                      ▼
                               Platform Response
```

### Memory Flow

```
New Memory → Embedding Generation → Vector Storage
                                         │
                                         ▼
Query Request → Embedding Query → Similarity Search → Result Ranking
```

## Security Architecture

### Authentication & Authorization
- Token-based authentication for platform APIs
- Role-based access control for plugin capabilities
- Secure credential storage and management

### Data Protection
- Encryption at rest for sensitive data
- Secure communication channels (TLS/SSL)
- Privacy-preserving memory management

### Input Validation
- Comprehensive input sanitization
- Rate limiting and abuse prevention
- Content filtering and safety checks
```

### Component Documentation Standards

```markdown
# ✅ DO: Detailed component documentation with examples

# Actions Documentation

## Overview

Actions define what an ElizaOS agent can do in response to messages or events. They encapsulate specific behaviors and capabilities that can be triggered based on message content, context, or user commands.

## Action Interface

```typescript
interface Action {
  name: string;                    // Unique identifier
  description: string;             // Human-readable description
  examples: MessageExample[][];    // Training examples
  validate?: (runtime: IAgentRuntime, message: Memory) => Promise<boolean>;
  handler: (runtime: IAgentRuntime, message: Memory, state?: State) => Promise<boolean>;
}
```

## Implementation Guide

### Basic Action Structure

```typescript
import { Action, IAgentRuntime, Memory, State } from '@elizaos/core';

export const exampleAction: Action = {
  name: 'EXAMPLE_ACTION',
  description: 'An example action that demonstrates basic structure',
  
  examples: [
    [
      {
        user: '{{user1}}',
        content: { text: 'trigger phrase' }
      },
      {
        user: '{{agent}}',
        content: { text: 'Expected response', action: 'EXAMPLE_ACTION' }
      }
    ]
  ],

  validate: async (runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
    // Validation logic - return true if action should handle this message
    return message.content.text?.toLowerCase().includes('trigger phrase') || false;
  },

  handler: async (runtime: IAgentRuntime, message: Memory, state?: State): Promise<boolean> => {
    try {
      // Action implementation
      const response = await processMessage(message, state);
      
      // Create response memory
      await runtime.messageManager.createMemory({
        userId: runtime.agentId,
        content: {
          text: response,
          action: 'EXAMPLE_ACTION'
        },
        roomId: message.roomId,
        embedding: await generateEmbedding(response)
      });

      return true;
    } catch (error) {
      console.error('Action execution failed:', error);
      return false;
    }
  }
};
```

#### Validation
- **Be Specific**: Use precise validation criteria to avoid conflicts
- **Performance**: Keep validation logic lightweight
- **Error Handling**: Always handle validation errors gracefully

```typescript
// ✅ Good: Specific and efficient validation
validate: async (runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
  const text = message.content.text?.toLowerCase();
  return text?.includes('weather') && text?.includes('forecast');
}

// ❌ Bad: Too broad validation
validate: async (runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
  return message.content.text?.length > 0;
}
```

#### Handler Implementation
- **Idempotency**: Handlers should be safe to run multiple times
- **Error Recovery**: Implement proper error handling and logging
- **State Management**: Use state parameter for context-aware responses

```typescript
// ✅ Good: Robust handler with error handling
handler: async (runtime: IAgentRuntime, message: Memory, state?: State): Promise<boolean> => {
  try {
    // Validate inputs
    if (!message.content.text) {
      throw new Error('Empty message content');
    }

    // Process with context
    const context = state?.recentMessages || [];
    const response = await generateResponse(message.content.text, context);

    // Store result
    await runtime.messageManager.createMemory({
      userId: runtime.agentId,
      content: { text: response, action: this.name },
      roomId: message.roomId,
      embedding: await runtime.embed(response)
    });

    return true;
  } catch (error) {
    console.error(`${this.name} handler failed:`, error);
    return false;
  }
}
```

## Testing Actions

### Unit Testing

```typescript
import { describe, it, expect, beforeEach, vi } from 'bun';
import { exampleAction } from './example-action.js';

describe('ExampleAction', () => {
  let mockRuntime: IAgentRuntime;
  let mockMessage: Memory;

  beforeEach(() => {
    mockRuntime = createMockRuntime();
    mockMessage = createMockMessage();
  });

  it('should validate trigger phrases correctly', async () => {
    mockMessage.content.text = 'trigger phrase example';
    const isValid = await exampleAction.validate(mockRuntime, mockMessage);
    expect(isValid).toBe(true);
  });

  it('should handle execution successfully', async () => {
    const result = await exampleAction.handler(mockRuntime, mockMessage);
    expect(result).toBe(true);
    expect(mockRuntime.messageManager.createMemory).toHaveBeenCalled();
  });
});
```

## Common Patterns

### API Integration Actions
```typescript
export const apiCallAction: Action = {
  name: 'API_CALL',
  description: 'Makes API calls to external services',
  
  handler: async (runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
    const client = new APIClient({
      token: runtime.character.settings.secrets.apiToken,
      rateLimiter: new RateLimiter(100, 60000) // 100 calls per minute
    });

    try {
      const result = await client.makeRequest(message.content.text);
      // Handle response...
      return true;
    } catch (error) {
      if (error instanceof RateLimitError) {
        // Queue for retry
        await runtime.scheduler.schedule(this, message, Date.now() + error.retryAfter);
      }
      throw error;
    }
  }
};
```

### Multi-step Actions
```typescript
export const multiStepAction: Action = {
  name: 'MULTI_STEP',
  description: 'Handles multi-step workflows',
  
  handler: async (runtime: IAgentRuntime, message: Memory, state?: State): Promise<boolean> => {
    const workflow = new WorkflowManager(runtime);
    
    // Check if continuing existing workflow
    const existingWorkflow = await workflow.getActive(message.userId);
    if (existingWorkflow) {
      return await workflow.continue(existingWorkflow, message);
    }
    
    // Start new workflow
    return await workflow.start('workflow-type', message, state);
  }
};
```
```

### API Documentation Standards

```markdown
# ✅ DO: Comprehensive API documentation

# ElizaOS Core API Reference

## AgentRuntime

The main runtime class that orchestrates agent behavior and manages the execution environment.

### Constructor

```typescript
constructor(config: AgentRuntimeConfig)
```

**Parameters:**
- `config`: Configuration object for the runtime

```typescript
interface AgentRuntimeConfig {
  character: Character;              // Agent character configuration
  databaseAdapter: DatabaseAdapter; // Database connection
  token: string;                     // API token for LLM provider
  modelProvider: ModelProvider;      // LLM provider (openai, anthropic, etc.)
  actions?: Action[];               // Custom actions
  providers?: Provider[];           // Custom providers
  evaluators?: Evaluator[];         // Custom evaluators
}
```

**Example:**
```typescript
const runtime = new AgentRuntime({
  character: {
    name: 'MyAgent',
    bio: 'A helpful assistant',
    // ... other character properties
  },
  databaseAdapter: new PostgresDatabaseAdapter({
    connectionString: process.env.DATABASE_URL
  }),
  token: process.env.OPENAI_API_KEY,
  modelProvider: 'openai',
  actions: [customAction1, customAction2],
  providers: [customProvider],
  evaluators: [customEvaluator]
});
```

### Methods

#### `initialize(): Promise<void>`

Initializes the runtime and all registered components.

**Returns:** Promise that resolves when initialization is complete

**Throws:** 
- `RuntimeError` - If initialization fails
- `DatabaseError` - If database connection fails

**Example:**
```typescript
try {
  await runtime.initialize();
  console.log('Runtime initialized successfully');
} catch (error) {
  console.error('Failed to initialize runtime:', error);
}
```

#### `processMessage(message: Memory): Promise<void>`

Processes an incoming message through the action pipeline.

**Parameters:**
- `message`: Memory object containing the message to process

**Returns:** Promise that resolves when message processing is complete

**Example:**
```typescript
const message = {
  id: 'msg-123',
  userId: 'user-456',
  content: { text: 'Hello, can you help me?' },
  roomId: 'room-789',
  embedding: embeddings,
  createdAt: Date.now()
};

await runtime.processMessage(message);
```

#### `registerAction(action: Action): void`

Registers a new action with the runtime.

**Parameters:**
- `action`: Action object to register

**Throws:**
- `DuplicateActionError` - If action name already exists

**Example:**
```typescript
const myAction = {
  name: 'MY_ACTION',
  description: 'Custom action',
  examples: [],
  handler: async (runtime, message) => {
    // Action implementation
    return true;
  }
};

runtime.registerAction(myAction);
```

## Memory Manager

Manages persistent storage and retrieval of agent memories.

### Methods

#### `createMemory(memory: CreateMemoryInput): Promise<Memory>`

Creates a new memory in the database.

**Parameters:**
```typescript
interface CreateMemoryInput {
  userId: string;           // User who created the memory
  content: Content;         // Memory content
  roomId: string;          // Room/conversation identifier
  embedding?: number[];     // Optional pre-computed embedding
  unique?: boolean;        // Whether to enforce uniqueness
}
```

**Returns:** Promise resolving to the created Memory object

**Example:**
```typescript
const memory = await runtime.messageManager.createMemory({
  userId: 'user-123',
  content: {
    text: 'User asked about weather',
    metadata: { topic: 'weather', intent: 'query' }
  },
  roomId: 'room-456',
  embedding: await runtime.embed('User asked about weather')
});
```

#### `getMemories(params: GetMemoriesParams): Promise<Memory[]>`

Retrieves memories based on criteria.

**Parameters:**
```typescript
interface GetMemoriesParams {
  roomId?: string;         // Filter by room
  userId?: string;         // Filter by user
  count?: number;          // Maximum number to return (default: 10)
  unique?: boolean;        // Whether to return unique memories only
  start?: Date;           // Start date filter
  end?: Date;             // End date filter
}
```

**Returns:** Promise resolving to array of Memory objects

**Example:**
```typescript
// Get recent memories from a room
const recentMemories = await runtime.messageManager.getMemories({
  roomId: 'room-123',
  count: 5
});

// Get memories from a specific user
const userMemories = await runtime.messageManager.getMemories({
  userId: 'user-456',
  count: 20
});
```

#### `searchMemoriesByEmbedding(embedding: number[], options: SearchOptions): Promise<Memory[]>`

Performs semantic search using vector embeddings.

**Parameters:**
- `embedding`: Query embedding vector
- `options`: Search configuration options

```typescript
interface SearchOptions {
  match_threshold?: number;  // Similarity threshold (0-1)
  count?: number;           // Maximum results to return
  roomId?: string;          // Limit search to specific room
  userId?: string;          // Limit search to specific user
}
```

**Returns:** Promise resolving to array of Memory objects sorted by similarity

**Example:**
```typescript
const queryEmbedding = await runtime.embed('What did we discuss about weather?');

const similarMemories = await runtime.messageManager.searchMemoriesByEmbedding(
  queryEmbedding,
  {
    match_threshold: 0.8,
    count: 10,
    roomId: 'room-123'
  }
);
```

## Error Handling

### Standard Error Types

```typescript
// Runtime errors
class RuntimeError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'RuntimeError';
  }
}

// Database errors
class DatabaseError extends Error {
  constructor(message: string, public query?: string) {
    super(message);
    this.name = 'DatabaseError';
  }
}

// Validation errors
class ValidationError extends Error {
  constructor(message: string, public field: string) {
    super(message);
    this.name = 'ValidationError';
  }
}
```

### Error Handling Patterns

```typescript
try {
  await runtime.processMessage(message);
} catch (error) {
  if (error instanceof ValidationError) {
    console.error('Invalid input:', error.field, error.message);
    // Handle validation error
  } else if (error instanceof DatabaseError) {
    console.error('Database error:', error.message);
    // Handle database error
  } else {
    console.error('Unexpected error:', error);
    // Handle unknown error
  }
}
```
```

### Development Documentation

```markdown
# ✅ DO: Comprehensive development guide

# ElizaOS Development Guide

## Getting Started

### Prerequisites

- Node.js 20+ (recommend using fnm or nvm)
- PostgreSQL 15+ with pgvector extension
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/ai16z/eliza.git
   cd eliza
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Set up database**
   ```bash
   # Start PostgreSQL (using Docker)
   docker run -d \
     --name eliza-postgres \
     -e POSTGRES_DB=eliza \
     -e POSTGRES_USER=eliza \
     -e POSTGRES_PASSWORD=eliza \
     -p 5432:5432 \
     pgvector/pgvector:pg15
   
   # Run migrations
   npm run db:migrate
   ```

5. **Build the project**
   ```bash
   npm run build
   ```

6. **Start development server**
   ```bash
   npm run dev
   ```

## Creating a New Plugin

```typescript
// src/index.ts
import { Plugin } from '@elizaos/core';
import { exampleAction } from './actions/example.js';
import { exampleProvider } from './providers/example.js';
import { exampleEvaluator } from './evaluators/example.js';

export const myPlugin: Plugin = {
  name: 'my-plugin',
  description: 'Description of what the plugin does',
  dependencies: [], // Other plugins this depends on
  
  actions: [exampleAction],
  providers: [exampleProvider],
  evaluators: [exampleEvaluator],
  services: [], // Optional background services
  
  async initialize(runtime) {
    console.log('Initializing my plugin');
    // Plugin initialization logic
  },
  
  async cleanup() {
    console.log('Cleaning up my plugin');
    // Plugin cleanup logic
  }
};

export default myPlugin;
```

### Testing Your Plugin

```typescript
// tests/unit/plugin.test.ts
import { describe, it, expect, beforeEach } from 'bun';
import { TestRuntimeFactory } from '@elizaos/testing';
import { myPlugin } from '../src/index.js';

describe('MyPlugin', () => {
  let runtime;

  beforeEach(async () => {
    runtime = await TestRuntimeFactory.createTestRuntime({}, {
      plugins: [myPlugin]
    });
  });

  it('should initialize successfully', () => {
    expect(runtime.plugins.has('my-plugin')).toBe(true);
  });

  it('should register actions', () => {
    expect(runtime.actions.has('EXAMPLE_ACTION')).toBe(true);
  });
});
```

## Code Style Guide

### TypeScript Guidelines

#### Types and Interfaces

```typescript
// ✅ Use interface for object shapes that might be extended
interface UserConfig {
  name: string;
  age: number;
  preferences?: string[];
}

// ✅ Use type for unions, primitives, and complex types
type Status = 'active' | 'inactive' | 'pending';
type EventHandler = (event: Event) => void;

// ✅ Use const assertions for immutable data
const PLUGIN_TYPES = ['action', 'provider', 'evaluator'] as const;
type PluginType = typeof PLUGIN_TYPES[number];
```

#### Naming Conventions

```typescript
// ✅ PascalCase for classes, interfaces, types
class AgentRuntime { }
interface MessageContent { }
type ActionResult = boolean;

// ✅ camelCase for variables, functions, methods
const agentConfig = { };
function processMessage() { }

// ✅ SCREAMING_SNAKE_CASE for constants
const MAX_RETRY_ATTEMPTS = 3;
const DEFAULT_TIMEOUT_MS = 5000;

// ✅ kebab-case for file names
// action-handler.ts
// message-processor.ts
```

#### Error Handling

```typescript
// ✅ Use specific error types
class PluginError extends Error {
  constructor(
    message: string,
    public pluginName: string,
    public code: string
  ) {
    super(message);
    this.name = 'PluginError';
  }
}

// ✅ Handle errors at appropriate levels
async function processAction(action: Action, message: Memory): Promise<boolean> {
  try {
    return await action.handler(runtime, message);
  } catch (error) {
    if (error instanceof PluginError) {
      console.error(`Plugin ${error.pluginName} failed:`, error.message);
      return false;
    }
    throw error; // Re-throw unexpected errors
  }
}
```

### Documentation Standards

#### Function Documentation

```typescript
/**
 * Processes a message through the action pipeline.
 * 
 * @param message - The message to process
 * @param context - Additional context for processing
 * @returns Promise resolving to processing result
 * 
 * @throws {ValidationError} When message format is invalid
 * @throws {RuntimeError} When processing fails
 * 
 * @example
 * ```typescript
 * const result = await processMessage(message, { userId: 'user-123' });
 * if (result.success) {
 *   console.log('Message processed successfully');
 * }
 * ```
 */
async function processMessage(
  message: Memory,
  context: ProcessingContext
): Promise<ProcessingResult> {
  // Implementation
}
```

#### README Template

```markdown
# Plugin Name

Brief description of what the plugin does.

## Features

- Feature 1
- Feature 2
- Feature 3

## Installation

```bash
npm install @elizaos/plugin-name
```

## Configuration

```typescript
const config = {
  apiKey: process.env.API_KEY,
  timeout: 5000
};
```

## Usage

```typescript
import { pluginName } from '@elizaos/plugin-name';

const runtime = new AgentRuntime({
  // ... other config
  plugins: [pluginName]
});
```

## API Reference

### Actions

#### ACTION_NAME
Description of what the action does.

**Triggers:** When this action is triggered
**Parameters:** Parameters it accepts
**Returns:** What it returns

### Providers

#### PROVIDER_NAME
Description of what the provider supplies.

## Contributing

See [CONTRIBUTING.md](mdc:../../CONTRIBUTING.md) for guidelines.

## License

MIT
```

## Testing Guidelines

### Unit Testing

```typescript
// ✅ Test structure
describe('ComponentName', () => {
  describe('methodName', () => {
    it('should handle normal case', () => {
      // Test implementation
    });
    
    it('should handle edge case', () => {
      // Test implementation
    });
    
    it('should throw error on invalid input', () => {
      // Test implementation
    });
  });
});
```

### Integration Testing

```typescript
// ✅ Integration test setup
describe('Plugin Integration', () => {
  let runtime: IAgentRuntime;
  
  beforeEach(async () => {
    runtime = await TestRuntimeFactory.createTestRuntime({}, {
      plugins: [testPlugin]
    });
  });
  
  afterEach(async () => {
    await TestRuntimeFactory.cleanup();
  });
  
  it('should integrate with runtime correctly', async () => {
    // Test plugin integration
  });
});
```

## Performance Guidelines

### Memory Management

```typescript
// ✅ Clean up resources
class ResourceManager {
  private resources = new Map();
  
  async cleanup() {
    for (const [id, resource] of this.resources) {
      try {
        await resource.cleanup();
      } catch (error) {
        console.warn(`Failed to cleanup resource ${id}:`, error);
      }
    }
    this.resources.clear();
  }
}
```

### Async Operations

```typescript
// ✅ Use Promise.all for concurrent operations
const results = await Promise.all([
  fetchUserData(userId),
  fetchPreferences(userId),
  fetchHistory(userId)
]);

// ✅ Use proper error boundaries
async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
  throw new Error('Max retries exceeded');
}
```
```
## ElizaOS Testing Architecture

ElizaOS employs a unified testing strategy orchestrated by the `elizaos test` command, as defined in `packages/cli/src/commands/test.ts`. This command programmatically sets up a real `AgentServer` and `AgentRuntime`, using a `TestRunner` class to execute both component-level and end-to-end tests within a live, in-process environment. This approach ensures that tests run against the actual runtime, providing high-fidelity validation of component interactions and agent behavior.

### Testing Flow

```mermaid
graph TD
    A[elizaos test] --> B{Build Project/Plugin};
    B --> C{Start In-Process AgentServer};
    C --> D{Initialize AgentRuntime};
    D --> E(Load Character & Plugins);
    E --> F[Create TestRunner];
    F --> G{Run Tests};
    
    subgraph "Test Types"
        G --> H[Component Tests (bun)];
        G --> I[E2E / Integration Tests];
    end

    I --> J[Simulate User Interaction];
    J --> D;
    
    G --> K[Assert Behavior & State];
    K --> L[Teardown Server & Runtime];
```

### Key Components

*   **`elizaos test`**: The main CLI command that bootstraps the entire testing process. It handles project building, server setup, and test execution.
*   **`AgentServer`**: A real server is started in-process to handle agent lifecycle and communication, providing a realistic test environment.
*   **`AgentRuntime`**: A real instance of the agent's core runtime is created, loading the actual character, plugins, and services for the project being tested.
*   **`TestRunner`**: A dedicated class that discovers and executes test files, passing the live `AgentRuntime` instance to them.
*   **PGLite**: The default database for testing is an in-memory PGLite instance, ensuring tests are fast and isolated without requiring an external database server.
*   **`bun`**: Used for component-level tests that can be run via `bun bun`, and also leveraged by the `TestRunner` for its assertion library.

## Writing E2E and Integration Tests

Because the `TestRunner` provides a live `AgentRuntime`, there is little distinction between "integration" and "E2E" tests. Both are written as test suites that interact with the live agent.

```typescript
// ✅ DO: Write tests that leverage the live runtime provided by TestRunner.
// This example would be in a file like `tests/e2e/conversation.test.ts`

import { type IAgentRuntime } from '@elizaos/core';
import { TestSuite } from '../utils/test-suite'; // A simple test runner utility

// The TestRunner will instantiate this class and call its methods.
export default class ConversationTestSuite extends TestSuite {
  public name = "Conversation Flow E2E Test";

  public tests = {
    "Agent should respond to a greeting": async (runtime: IAgentRuntime) => {
      // 1. Arrange: Simulate an incoming message
      const userMessage = {
        roomId: 'e2e-test-room',
        content: { text: "Hello agent!" },
        // ... other memory properties
      };

      // 2. Act: Process the message through the live runtime
      await runtime.handleMessage(userMessage);

      // 3. Assert: Verify the agent's response from the database
      const memories = await runtime.getMemories({ roomId: 'e2e-test-room', count: 2 });
      
      this.expect(memories.length).toBe(2);
      const agentResponse = memories.find(m => m.agentId === runtime.agentId);
      this.expect(agentResponse).toBeDefined();
      this.expect(agentResponse.content.text).toContain("Hello");
    },

    "Agent should remember context in a follow-up message": async (runtime: IAgentRuntime) => {
      // Arrange: Send initial message to set context
      await runtime.handleMessage({
        roomId: 'e2e-context-test',
        content: { text: "My favorite color is blue." }
      });

      // Act: Ask a follow-up question
      await runtime.handleMessage({
        roomId: 'e2e-context-test',
        content: { text: "Do you remember my favorite color?" }
      });
      
      // Assert: Check if the agent uses the remembered context
      const memories = await runtime.getMemories({ roomId: 'e2e-context-test', count: 4 });
      const lastAgentResponse = memories.find(m => m.agentId === runtime.agentId);

      this.expect(lastAgentResponse.content.text.toLowerCase()).toContain("blue");
    }
  };
}
```

## Writing Component (`bun`) Tests

While the `TestRunner` handles E2E tests, you should still write focused unit tests for individual components using `bun` directly. This is faster and allows for more granular testing of edge cases.

```typescript
// ✅ DO: Write focused unit tests for components using bun mocks.
// Location: packages/my-plugin/src/actions.test.ts

import { describe, it, expect, beforeEach, vi } from 'bun';
import { type IAgentRuntime, type Memory } from '@elizaos/core';
import { createMockRuntime } from '../../tests/mocks/runtime'; // Use your unit test mock
import { myAction } from './actions';

describe('myAction Unit Test', () => {
  let mockRuntime: IAgentRuntime;
  let mockMessage: Memory;

  beforeEach(() => {
    mockRuntime = createMockRuntime();
    mockMessage = {
      content: { text: 'Execute my-action with value: 123' },
      // ... other properties
    };
  });

  it('should correctly parse the value from the message', async () => {
    // Spy on a method to ensure it's called with the correct, parsed value
    vi.spyOn(mockRuntime, 'createEntity');

    await myAction.handler(mockRuntime, mockMessage);

    expect(mockRuntime.createEntity).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        data: { parsedValue: 123 }
      })
    );
  });

  // ❌ DON'T: Rely on a live runtime for unit tests.
  // Mocks provide control and speed.
});
```

## ElizaOS Core Types and Interfaces

This document provides a comprehensive guide to the core types and interfaces used throughout the ElizaOS v2 ecosystem. Understanding these data structures is essential for developing plugins, services, and interacting with the `AgentRuntime`.

### Type Architecture Overview

The type system is designed to be modular and extensible. The `IAgentRuntime` serves as the central hub, interacting with various components like `Plugins`, which in turn provide `Actions`, `Providers`, and `Evaluators`. All these components operate on a set of core data structures like `Memory`, `Entity`, `Room`, and `World`.

## 1. Core Runtime & Configuration

These interfaces define the agent itself and its operational environment.

### `IAgentRuntime`
The `IAgentRuntime` is the most important interface in ElizaOS. It represents the live, operational state of an agent. It provides the API for all memory operations, service access, and component interactions. When you write a component, the `runtime` instance is your gateway to the rest of the system.

**Key Responsibilities:**
*   Managing the agent's lifecycle (`initialize`, `start`, `stop`).
*   Providing access to the database via `IDatabaseAdapter` methods.
*   Orchestrating `Action`, `Provider`, and `Evaluator` execution.
*   Managing the lifecycle of `Services`.
*   Emitting and listening to system-wide events.

```typescript
// ✅ DO: Always use the provided `runtime` instance inside your components.
import { type IAgentRuntime, type Action } from '@elizaos/core';

const exampleAction: Action = {
  name: "EXAMPLE_ACTION",
  // ...
  handler: async (runtime: IAgentRuntime, message) => {
    // Correct: Use the runtime to access other parts of the system.
    const recentMemories = await runtime.getMemories({ roomId: message.roomId, count: 5 });
    const myService = runtime.getService('MyService');
    // ...
    return true;
  }
}
```

### `Character`
The `Character` interface defines the agent's personality, configuration, and capabilities. It's a plain object that is passed to the `AgentRuntime` upon creation.

```typescript
// Reference: packages/core/src/types.ts
export interface Character {
  /** Agent's name */
  name: string;
  /** Agent's biography or description */
  bio: string | string[];
  /** The base system prompt for the LLM */
  system?: string;
  /** Examples to guide the agent's response style */
  messageExamples?: MessageExample[][];
  /** A list of plugin packages to load */
  plugins?: string[];
  /** Agent-specific settings and secrets */
  settings?: {
    [key: string]: any;
  };
  secrets?: {
    [key: string]: any;
  };
  // ... and other personality/style fields
}
```

### `Plugin`
Plugins are the primary way to extend an agent's functionality. They are objects that bundle together components (`Actions`, `Providers`, etc.) and `Services` for the runtime to register.

```typescript
// Reference: packages/core/src/types.ts
export interface Plugin {
  /** Unique name for the plugin */
  name: string;
  /** Human-readable description */
  description: string;
  /** Optional components to register */
  actions?: Action[];
  providers?: Provider[];
  evaluators?: Evaluator[];
  /** Optional services to start */
  services?: (typeof Service)[];
  /** List of other plugin names this plugin depends on */
  dependencies?: string[];
}
```

---

## 2. Core Components

These are the building blocks of agent behavior, registered via `Plugins`.

### `Action`
An `Action` defines something the agent can *do*. It contains a `validate` function to help the LLM decide if the action is appropriate and a `handler` function containing the core logic.

```typescript
// Reference: packages/core/src/types.ts
export interface Action {
  name: string;
  description: string;
  examples: ActionExample[][];
  validate: Validator; // (runtime, message, state) => Promise<boolean>
  handler: Handler;    // (runtime, message, state, ...) => Promise<unknown>
}
```

### `Provider`
A `Provider` supplies the agent with contextual information. It has a `get` method that returns data, which the `AgentRuntime` then composes into the final context for the LLM.

```typescript
// Reference: packages/core/src/types.ts
export interface Provider {
  name: string;
  description?: string;
  get: (runtime: IAgentRuntime, message: Memory, state: State) => Promise<ProviderResult>;
}

export interface ProviderResult {
  text?: string;
  data?: { [key: string]: any; };
  values?: { [key: string]: any; };
}
```

### `Evaluator`
An `Evaluator` allows the agent to reflect on its performance or analyze a conversation after the fact.

```typescript
// Reference: packages/core/src/types.ts
export interface Evaluator {
  name: string;
  description: string;
  alwaysRun?: boolean; // If true, runs even if the agent didn't respond
  handler: Handler;
}
```

---

## 3. Data Model

These interfaces represent the core data objects that the agent operates on. They are stored in the database via the `IDatabaseAdapter`.

### `Memory`
A `Memory` is the most fundamental data structure, representing a single piece of information, most often a message.

```typescript
// Reference: packages/core/src/types.ts
export interface Memory {
  id?: UUID;
  entityId: UUID; // The ID of the entity that created the memory (e.g., a user)
  roomId: UUID;
  worldId?: UUID;
  content: Content;
  embedding?: number[];
  createdAt?: number;
}

export interface Content {
  text?: string;
  actions?: string[];
  // ... and other fields
}
```

### `Entity`, `Room`, `World`
These structures model the environment the agent exists in.
*   **`Entity`**: Represents an actor or object (a user, another agent, a concept).
*   **`Room`**: Represents a specific context for interaction (a chat channel, a DM).
*   **`World`**: A collection of rooms and entities (a Discord server, a project).

```typescript
// Reference: packages/core/src/types.ts
export interface Entity {
  id?: UUID;
  names: string[];
  metadata?: { [key: string]: any };
  agentId: UUID;
}

export interface Room {
  id: UUID;
  name?: string;
  source: string; // e.g., 'discord', 'cli'
  type: ChannelType; // e.g., DM, GROUP
  worldId?: UUID;
}

export interface World {
  id: UUID;
  name?: string;
  agentId: UUID;
  serverId: string; // The platform-specific ID for the world
}
```

### `Relationship`
This allows you to create a knowledge graph by linking two `Entities` together with a typed relationship.

```typescript
// Reference: packages/core/src/types.ts
export interface Relationship {
  id: UUID;
  sourceEntityId: UUID;
  targetEntityId: UUID;
  tags: string[];
  metadata: { [key: string]: any; };
}
```

# General Development Rules

Please follow these carefully

- Always plan your actions. Don't just start doing-- review the code, assert you have real, complete understanding of the problem, and then implement your changes

- You often say "I understand now!" but you don't. Be extremely critical, especially of yourself and your own conclusions. Unless you've tested your conclusions, you just don't know

- Clean up after yourself. Don't leave `test-*.mjs` or `fix-*.ts` around. That's so bad. If you make files you don't need, delete them after. Better yet, don't make new files for stuff that isn't going to stay in core. You can just run code or shell instead.

- Always make sure you're using the actual elizaOS runtime and building the actual game and not shortcutting with other systems if you run into trouble

- KEEP IT SIMPLE. Plugins should never have more than a couple of services, a few actions and providers. Don't make an "EnhancedActionService" when you already have an ActionService. Just use the ActionService and fix it.

- BE CONCISE. Always ask yourself-- is there a simpler solution that is production ready? Is there something I'm not missing that's causing me to write code that may be duplicate? Try to solve every problem with the least amount of new code and changes necessary

- TEST EVERYTHING WITH CYPRESS-- Every aspect of the game has to be tested with Cypress. We want screenshots, and we want to validate with OCR (character recognition) that things we expect do appearon screen.

-- ALWAYS FIX EVERYTHING. Any error in the backend or frontend is unacceptable. Always set up testing so you can see all of the errors at once at the end and handle them. Never believe you are error-free unless you can see confirmation of all tests passing.

--  PRODUCITON CODE ONLY. No LARP, no stub, no hardcode, no "will fix later". Always take the time to write out the complete implementation, even if it has errors we'll fix them. Better to be thorough.


# e2e Testing Is The Most Important Aspect of this Project

For testing, we use Cypress. Testing architecture is very important to us, and this is a big focus of the game package. Everything must be testable. We don't like unit tests-- instead, we try build a testing harness that captures errors from the backend and frontend while running through real scripts and scenarios between our user and the agent/console.

If it doesn't have a real test, with real API keys, a real agent runime, in a real browser in the real application-- it's not testing anything. Those are the requirements. We don't use mocks. Instead, we build and test real scenarios using our actual code.

Our testing focus is 100% on Cypress and end-to-end testing. Since errors can get swallowed, make sure we have good error logging and the errors are always repeated back and the end of a testing log. Also make sure that we have reasonable timeouts on testing so we don't get stuck.

It's very important that our project is CLI-friendly, doesn't hang or wait too much, and ends the process on failure with clear error logs so our Cursor and Claude agents can rapidly iterate.

To be clear: NO MOCKS. NO HARDCODE. NO LARP. Always test the real thing, under real conditions, even if it uses API keys or costs money. API keys are available in the .env at the project root. Use dotenv.