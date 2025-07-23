#!/usr/bin/env node
import Fastify from 'fastify';
import { config } from './src/config/config.js';
import { handleMessagesRequest } from './src/handlers/requestHandler.js';

// Create Fastify server
const fastify = Fastify({
  logger: true
});

// Register the main route
fastify.post('/v1/messages', handleMessagesRequest);

// Start the server
const start = async () => {
  try {
    await fastify.listen({ port: config.port });
    console.log(`Server listening on port ${config.port}`);
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
};

start();