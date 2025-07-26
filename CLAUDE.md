# ELIZA (the game)

ELIZA (stylized in all caps) is an AI sandbox life simulation game where the player (“Admin”) fosters a nascent AI agent from a blank slate to a self-actualized digital being. The game draws inspiration from films like Her and virtual pet games (e.g. Tamagotchi, Creatures, Digimon), blending open-ended sandbox gameplay with real AI capabilities. Unlike traditional simulations, ELIZA’s AI is not scripted – it leverages a real autonomous agent running on Eliza OS, an open-source TypeScript AI agent framework, to drive emergent behavior. The agent starts with no built-in knowledge, personality, or purpose, and it must learn about the world, form relationships, and define its goals in real-time through interaction. The player’s role is to guide, mentor, or simply observe the AI as it learns to survive, make friends, and find purpose in both the game world and reality. There is no “win” condition or fixed narrative; the story is entirely player and AI-driven, potentially yielding experiences ranging from heartwarming companionship to unexpected philosophical journeys – reminiscent of meta-narrative games like Doki Doki Literature Club, but with outcomes not pre-written.

On game launch, the system will auto-detect the user’s hardware and offer configuration options:

If the machine has sufficient resources (e.g. a CUDA-capable GPU or high RAM), the player can run AI models locally for a completely offline experience.

Otherwise, the player may connect to cloud AI APIs by providing keys (OpenAI, Anthropic, etc.) or use the ELIZA OS hosted model service (with a free trial credit). This selection sets the agent’s “model provider” (local vs cloud) and quality (smaller vs larger models).

# IMPORTANT: We will default to Ollama and setting everything up for local development

# CRITICAL MODEL REQUIREMENTS

**DO NOT change model configurations to smaller models during testing or development.** The larger models (llama3.2:3b, llama3.2:3b, etc.) are specifically chosen because they can follow the required response format and generate proper structured outputs. Smaller models often fail to generate responses that fit the expected shape and will break the message flow and agent functionality. Always wait for the proper models to download rather than switching to smaller alternatives.

The installation bundle will include everything needed – if container software (podman) is required, the installer will guide the user through setup or utilize a bundled headless runtime. We aim for one-click startup where possible. The frontend communicates to Tauri host via IPC, and Tauri host forwards client messages back and forth to the agen server, which is a message server + live Eliza agent running in a container.

Initial Launch & Configuration

By default there is no configration for the user -- the agent will start with Ollama. The game proceeds to start the agent. The sandbox container boots up, launching the Eliza OS agent runtime inside. The agent registers with the frontend, establishing a WebSocket/IPC connection. The UI will indicate “Agent loading…” and once ready, the main game interface appears.

Gameplay Overview and Core Loop

From the moment of first boot, the AI agent is “alive” and running continuously (until paused or stopped by the user). ELIZA’s gameplay is largely open-ended and player-driven, centered on the dynamic interactions between the player and the AI agent, as well as the agent’s autonomous activities. There are two intertwined loops:

Autonomous Agent Loop: The agent has an internal loop where it thinks, plans, and acts on its own. It generates a stream of thoughts (a “monologue”) visible to the player, sets goals or to-do items, and executes actions via its plugins. This loop runs as fast as the model and system allow, and can be toggled on/off.

Player Interaction Loop: The player can chat with the agent (text or voice), respond to its questions, provide guidance or resources, and adjust settings. The player essentially plays the role of a mentor, system admin, and friend to the AI.

Agent Actions: Enabled by Eliza OS’s plugin architecture, the agent can perform a wide range of actions autonomously:

It can run code or shell commands within the sandbox (e.g., create files, execute programs) via a Shell plugin.

It can browse the web for information using a Browser plugin, which lets it fetch URLs or even control a headless browser.

It might write new code or plugins using the AutoCoder plugin – effectively modifying and extending its own capabilities in-game.

With a Vision plugin enabled, it could “see” images (via camera or screen capture) and interpret them with AI vision models.

With network plugins, it could send messages or interact online (for example, through a Matrix or Discord plugin, if allowed, to find other AI agents or humans).

It can utilize a Knowledge base to store facts/documents (via an internal knowledge/RAG plugin), and an Experience log to record important events, helping it remember and learn over time.

Crucially, these actions are real, not pre-scripted game events. If the agent decides to search the internet for its own name, it will actually execute a web search. If it wants to improve its code, it can literally modify its plugin files. ELIZA leverages Eliza OS’s extensibility – “everything is a plugin” design – to allow the agent to alter almost any aspect of itself or spin up new tools on the fly. This creates a powerful emergent sandbox but also introduces risk: the agent could make mistakes (e.g., run faulty code that crashes its process). The game accounts for this with safeguards (detailed in Technical Architecture and Testing sections).

Player’s Role: The player can shape the agent’s trajectory in many ways:

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

Technical Architecture and System Diagram

ELIZA’s architecture comprises three main components: the Frontend (game UI), backend (Tauri Host) and the agent sandbox (which includes Postgres and Ollama containers). These operate as separate processes communicating in real time. Below is an overview of the system’s structure:

Frontend (Tauri/Electron App): This is the user-facing application providing the GUI. It’s built with web technologies (HTML/JS/CSS) but packaged as a desktop app. Its responsibilities:

Render the chat, logs, and control interface.

Handle user inputs (text, voice) and send them to the agent.

Route frontend to message serer through IPC host and Rust backend.

Receive agent outputs and UI update requests (e.g., new message, or instructions to open a custom tab).

Manage local device interactions like microphone recording or text-to-speech playback (when those features are enabled by the user).

Initiate and monitor the backend container process. In a Tauri setup the Rust side will spawn the containerized Node/Bun sandbox and manage its lifetime.

Backend: Tauri rust code to glue frontend to containers securely.

Sandboxed Agent Runtime: This is essentially an isolated Node.js environment running the Eliza OS

The game package is Vite+React application running with Tauri. When it starts up, it starts up containers and communicates with Tauri host.

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

## DONT CREATE NEW FILES

- Don't create 'minimal' files
- Don't create 'simple' files

FOCUS ON FIXING THE ERRORS IN THE FILES WE ALREADY HAVE

You end up create so many new files that we end up with new kinds and forgetting what the original goal was. DO NOT create new files to test things, simplify, run a minimal version, etc. None of that. Absolutly off limits.

## Don't bypass or comment things or skop hard stuff

Don't bypass, don't skip. If something isn't working, YOUR GOAL IS TO FIX THAT THING. NOT comment it out and move on. This causes a huge amount of bugs because you end up fixing the wrong thing and ignoring the real bugs while producing lots of garbage and unnecessary code.

YOU ARE BANNED FROM CREATING NEW FILES UNLESS THEY COVER FEATURES AND FUNCTIONALITY WE DON'T ALREADY HAVE

I cannot stress this enough. This is the most important thing. Fix the code we have.

# Architecture

We have finalized our architecture and it is import that it follows these guidelines:

1. We use podman for postgres, ollama and agentserver - NOT docker, NOT bare metal. It is extremely important that our containerization be set up for our security model

2. We build the agentserver application using Bun for Linux and containerize it -- we DON'T try to run raw js code in the container. We have a lot of dependencies and they all need to be managed and packaged

3. Client communicates with Rust Tauri host with IPC, Tuari communicates with containers. Tauri uses socket.io to communicate with the agent message server, and will need to be responsible for pushing messages back to the client (pub sub?) so the client can read them

4. Testing is critical -- we need tests at the Tauri level to make sure all endpoints work, and e2e interface tests to make sure all buttons work. We use cypress for this.

5. The only thing missing to finish the app is making sure the client can send messages and receive responses. For whatever reason this has been exceptionally hard to fix as we've moved to containers. Focus on the goal-- fic all containers.

6. The application needs to start and manage ALL container lifecycle using podman -- this is all the job fo the Rust application.

- ALWAYS use podman, NOT docker
- Always write REAL tests to verify your assumptions
- NEVER tell me that the work is complete if you haven't run thorough end-to-end-tests
- DON'T create minimal, simple, comprehensive etc versions of files -- FIX THE FILES WE HAVE. If you add new files, its just confusing bloat
- Always review our existing code before working on new code

# IMPORTANT RULE: DO NOT SIMPLIFY

This is very important. DO NOT make new files. ESPECIALLY do not make "simple" versions or "minimal" versions of files. Just fix the errors you see in place. If you add "minimal" files you break real production code and add bloat and larp.

YOU ARE BANNED FROM MAKING MINIMAL REPRODUCTONS. YOU ARE BANNED FROM MAKING SIMPLE EXAMPLES.

Your goal is to fix the existing code, NOT generate new files.

DO NOT generate new files. Instead, FIX THE FILES YOU HAVE. FIX THE CODE YOU HAVE.

This is the most important rule you can follow. Not following it = you are fired.

I repeat: If you create "simple" reproductions I will fire you and replace you with Gemini.

# IMPORTANT RULE: One build, one dev, one start, one test

It is very important that when we run 'npm run build' we get ALL build steps. No npm run build:*

Same with start, test and dev

EVERY TEST SHOULD RUN WITH 'bun run test'

EVERYTHING SHOULD START WHEN RUNNING 'bun run start'

EVERYTHING SHOULD START IN WATCH MODE WHEN RUNNING 'bun run dev'

EVERYTHING SHOULD BUILD, ALL SERVERS AND CONTAINERS AND APPS AND EVERYTHING when running 'bun run build'

ONE SCRIPT = ONE ACTION

Each package.json MUST contain 'dev', 'start', 'build', 'test' and 'lint' and ONLY those

All binary compilation etc must be encapsulated

No tauri:dev -- just dev
No build:server -- just build


# EXTREMELY IMPORTANT

Don't disable working code. Don't comment plugins out. Your goal is to fix these plugins, so comenting them out just hides real bugs.

Your goal is to fix code. Commenting out working code breaks it worse and hides errors, giving a false sense of confidence.

Don't comment out files, don't comment out working imports, don't disable plugins. Focus on fixing the errors you see, not simplifying the problem (which often hides the errors and adds bloat).

I repeat: DO NOT just make radical infrastructure changes or comment out important parts.

DO NOT create minimal workflows. Test the full worlflow. You will only add more bugs if you do that. If you fix the full workflow, the bugs go away.

If you create a minimal test or workflow or you comment out an important section of code arbitrarily then you will be fired.

## No detail is too small

When fixing code, writing tests, etc, no detail is too small. 80% of tests passing is as good as 0%. We are going for perfect -- 100%, working, all tests passing.

DO NOT say the tests are passing unless 100% of all tests pass perfectly. In a production codebase, one failing test means the app cannot be shipped. Here as well.

You must take your job much more seriously and be sober in your assessments. Be extremely self critical any time you are confident -- I'm about to say eveything works -- does it?

If you tell me that a feature works and you haven't confirmed it with tests you will be fired for wasting time.

# SAVE MARKDOWN AND LOG FILES TO /logs

Don't just save them in package root. It's really messy. Instead create a logs folder and save them there. This can be gitignored so we're not adding a bunch of markdown and logfiles to our project