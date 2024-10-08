import { type Server, type Socket } from 'socket.io'
import LoggerService from '../services/logger.services.js'
import { type InMemoryRoomSessionStore } from '../store/InMemorySessionStore.js'
import { type UserID } from '../types.js'

export const registerRoom = async (
  io: Server,
  socket: Socket,
  roomsSessionStore: InMemoryRoomSessionStore,
): Promise<void> => {
  // persist session
  roomsSessionStore.saveSession(socket.roomID, socket.sessionID, {
    userName: socket.userName,
    userID: socket.userID,
    socketConnected: true,
    isRoomOwner: socket.isRoomOwner,
  })

  // emit session details
  socket.emit('room:session', {
    sessionID: socket.sessionID,
    userID: socket.userID,
    userName: socket.userName,
    roomID: socket.roomID,
    isRoomOwner: socket.isRoomOwner,
  })

  // join the room
  await socket.join(socket.roomID)
  // join the user's own room
  await socket.join(socket.userID)

  const users = roomsSessionStore.findAllSessions(socket.roomID)
  const usersWitoutMe = users.filter((user) => user.userID !== socket.userID)
  socket.emit('room:users', usersWitoutMe)

  socket.broadcast.to(socket.roomID).emit(`room:user-connected`, {
    userID: socket.userID,
    userName: socket.userName,
    isRoomOwner: socket.isRoomOwner,
    socketConnected: true,
  })

  socket.on('room:leave-room', async (kicked) => {
    LoggerService.socket(
      `${socket.isRoomOwner ? 'Owner' : 'User'} ${socket.userName} left the room: ${
        socket.roomID
      }, ${socket.userID}`,
    )

    if (socket.isRoomOwner) {
      // if the owner leaves the room, delete the room
      roomsSessionStore.removeRoom(socket.roomID)
    } else {
      roomsSessionStore.removeSession(socket.roomID, socket.sessionID)
    }

    if (!kicked)
      socket.broadcast.to(socket.roomID).emit(`room:user-leave`, {
        userID: socket.userID,
        userName: socket.userName,
      })

    await socket.leave(socket.roomID)
    await socket.leave(socket.userID)
  })

  socket.on('room:kick-user', async (userID: UserID) => {
    LoggerService.socket(`User ${socket.userID} kicked user ${userID} from room ${socket.roomID}`)
    socket.broadcast.to(socket.roomID).emit(`room:user-kicked`, { userID })
    socket.emit(`room:user-kicked`, { userID })
    roomsSessionStore.kickUser(socket.roomID, userID)
  })

  socket.on('room:toggle-lock', async (lock: boolean) => {
    LoggerService.socket(`The room ${socket.roomID} has been ${lock ? 'locked' : 'unlocked'}`)
    roomsSessionStore.toggleRoomLock(socket.roomID, lock)
  })

  socket.on('disconnect', () => {
    LoggerService.socket(
      `${socket.isRoomOwner ? 'Owner' : 'User'} ${socket.userName} disconnected from room: ${
        socket.roomID
      }`,
      socket.id,
    )

    const session = roomsSessionStore.findSession(socket.roomID, socket.sessionID)
    if (!session) return

    roomsSessionStore.saveSession(socket.roomID, socket.sessionID, {
      userName: socket.userName,
      userID: socket.userID,
      isRoomOwner: socket.isRoomOwner,
      socketConnected: false,
    })

    socket.broadcast.to(socket.roomID).emit(`room:user-disconnected`, {
      userID: socket.userID,
      userName: socket.userName,
    })
  })
}
