// src/useMessagingSocket.js
// Real-time channel for direct messages. Sends still go over REST
// (POST /v1/messages); this hook opens ONE STOMP-over-SockJS connection,
// authenticates with the JWT in the CONNECT frame (matching the backend's
// StompAuthChannelInterceptor), and streams everything the inbox needs:
//
//   /user/queue/messages       new messages                → onMessage(message)
//   /user/queue/typing         { conversationId, userId, typing }      → handlers.onTyping
//   /user/queue/presence       { userId, online }                      → handlers.onPresence
//   /user/queue/reactions      { conversationId, messageId, reactions }→ handlers.onReaction
//   /user/queue/read           { conversationId, readerId, readAt }    → handlers.onRead
//   /user/queue/conversations  { conversationId, status }              → handlers.onConversation
//
// and returns sendTyping(conversationId, typing) → SEND /app/typing.
//
// Deps:  npm i @stomp/stompjs sockjs-client
// Vite:  sockjs-client expects a `global`. If you hit "global is not defined",
//        add `define: { global: 'globalThis' }` to vite.config.js.

import { useCallback, useEffect, useRef, useState } from 'react';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

function resolveWsUrl() {
  // Backend origin without the /api suffix the REST client uses.
  const raw = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';
  const origin = raw.replace(/\/api\/?$/, '');
  return `${origin}/ws`;
}

const CHANNELS = [
  ['/user/queue/typing', 'onTyping'],
  ['/user/queue/presence', 'onPresence'],
  ['/user/queue/reactions', 'onReaction'],
  ['/user/queue/read', 'onRead'],
  ['/user/queue/conversations', 'onConversation'],
];

export function useMessagingSocket(onMessage, handlers = {}) {
  const [connected, setConnected] = useState(false);
  const messageRef = useRef(onMessage);
  const handlersRef = useRef(handlers);
  const clientRef = useRef(null);
  messageRef.current = onMessage;
  handlersRef.current = handlers;

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return undefined;

    const parse = (frame) => {
      try {
        return JSON.parse(frame.body);
      } catch (err) {
        console.error('[Messages] malformed socket frame dropped:', err?.message || err);
        return null;
      }
    };

    const client = new Client({
      webSocketFactory: () => new SockJS(resolveWsUrl()),
      connectHeaders: { Authorization: `Bearer ${token}` },
      reconnectDelay: 4000,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
      onConnect: () => {
        setConnected(true);
        client.subscribe('/user/queue/messages', (frame) => {
          const message = parse(frame);
          if (message) messageRef.current?.(message);
        });
        CHANNELS.forEach(([destination, key]) => {
          client.subscribe(destination, (frame) => {
            const event = parse(frame);
            if (event) handlersRef.current?.[key]?.(event);
          });
        });
      },
      onDisconnect: () => setConnected(false),
      onStompError: () => setConnected(false),
      onWebSocketClose: () => setConnected(false),
    });

    clientRef.current = client;
    client.activate();
    return () => {
      clientRef.current = null;
      client.deactivate();
    };
  }, []);

  const sendTyping = useCallback((conversationId, typing) => {
    const client = clientRef.current;
    if (!client?.connected || !conversationId) return;
    try {
      client.publish({ destination: '/app/typing', body: JSON.stringify({ conversationId, typing }) });
    } catch (err) {
      console.error('[Messages] typing frame failed:', err?.message || err);
    }
  }, []);

  return { connected, sendTyping };
}
