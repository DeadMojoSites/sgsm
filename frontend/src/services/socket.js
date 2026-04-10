import { io } from 'socket.io-client';

let socket = null;

export function getSocket() {
  if (!socket || socket.disconnected) {
    const token = localStorage.getItem('gsm_token');
    socket = io({ auth: { token }, autoConnect: true });
  }
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
