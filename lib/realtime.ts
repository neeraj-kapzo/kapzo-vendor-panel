import { io, type Socket } from 'socket.io-client'
import { getIdToken } from '@/lib/firebase'
import { apiBaseUrl } from '@/lib/api/http'

/**
 * Singleton Socket.IO connection to kapzo-backend. The handshake carries the
 * Firebase ID token in `auth.token`; the server verifies it and auto-joins
 * this socket to its user/vendor rooms. `auth` is a function so every
 * reconnect fetches a fresh (SDK-cached) token instead of replaying an
 * expired one.
 */
let socket: Socket | null = null

export function getSocket(): Socket {
  if (!socket) {
    socket = io(apiBaseUrl(), {
      transports: ['websocket', 'polling'],
      auth: (cb) => {
        getIdToken().then(
          (token) => cb({ token }),
          () => cb({}),
        )
      },
    })
  }
  return socket
}

export function disconnectSocket(): void {
  socket?.disconnect()
  socket = null
}
