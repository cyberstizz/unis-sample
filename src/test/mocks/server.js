// src/test/mocks/server.js
// Centralized mock backend. Tests can override specific handlers with server.use().

import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);
