# Agent Design Document

## Executive Summary
This agent, named WeatherBot, is designed to provide comprehensive weather reports based on the user's location. The agent can ask the user for their location and remember it for future interactions. The key capabilities include fetching detailed weather data like temperature, humidity, wind speed, precipitation, and UV index. 

## Agent Configuration
### Character Definition
- **Name and Description:** WeatherBot, a knowledgeable and responsive agent capable of providing detailed weather information based on the user's location.
- **System Prompt:** "Hello! May I know your location to provide you with the weather details?"
- **Example Messages:** "The current temperature in New York is 15°C with 60% humidity and a wind speed of 10 km/h."
- **Topics and Style:** Weather topics with a professional, informative tone.

### Actions and Tools
- **Actions:** Ask for user's location, fetch weather data, remember user's location, provide detailed weather report.
- **Required Providers and Services:** Location provider, Weather service provider.
- **API Integrations:** Weather API for fetching weather data (e.g., OpenWeatherMap).

### Behavioral Rules
- **Decision-making Logic:** If the user requests weather information, the agent asks for the user's location and fetches the relevant weather data.
- **Response Patterns:** The agent responds with detailed weather data, including temperature, humidity, wind speed, precipitation, and UV index.
- **Constraints and Guardrails:** The agent only provides weather data when asked by the user and does not store any sensitive user data.

## Technical Architecture
- **Required ElizaOS Plugins:** Weather Plugin, Location Plugin.
- **Custom Actions/Providers Needed:** Custom action for fetching and parsing detailed weather data; custom location provider for saving and retrieving user's location.
- **Database/Storage Requirements:** Storage for remembering user's location.
- **External Service Integrations:** Weather data API integration.

## Implementation Plan
### Phase 1: Core Setup
- Configure WeatherBot with basic abilities to fetch weather data and ask for user's location.
- Implement essential actions like fetching weather data and remembering user's location.

### Phase 2: Advanced Features
- Implement complex behaviors like fetching and parsing detailed weather data.
- Integrate with a weather data API.

### Phase 3: Optimization
- Optimize performance, response times, and data accuracy.
- Implement enhanced capabilities like providing more detailed weather information (e.g., UV index).

## File Structure
- **character.json:** Contains the agent's name, system prompt, example messages, and topics.
- **Custom Actions/Providers:** Separate files for custom actions (fetching and parsing weather data) and custom location provider.
- **Configuration Files:** Contains configuration details for the agent, including API integration details.
  

This Agent Design Document provides a comprehensive overview of the WeatherBot's functionalities, technical architecture, and implementation plan, ensuring a smooth development process.