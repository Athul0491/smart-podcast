import { useEffect } from 'react';
import { Socket, io } from 'socket.io-client';

type SocketCallback = (socket: Socket) => void;

export default function useSocket(onConnect: SocketCallback) {
  useEffect(() => {
    const socket = io('http://localhost:3000', {
      transports: ['websocket'],
    });

    onConnect(socket);

    return () => {
      socket.disconnect();
      console.log('🔌 Socket disconnected');
    };
  }, [onConnect]);
}
