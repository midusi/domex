import { type UUID } from 'crypto'

export type Session = {
  userName: string
  userID: UserID
  socketConnected: boolean
  isRoomOwner: boolean
}

export type RoomID = `${string & { length: 10 }}`
export type SessionID = UUID
export type UserID = UUID

export type RoomSessions = Map<SessionID, Session>

export type Room = {
  sessions: RoomSessions
  locked: boolean
}

export type Rooms = Map<RoomID, Room>

export type ReturningSignalParams = {
  callerID: UserID
  signal: SignalData
}

export type SendingSignalParams = ReturningSignalParams & {
  userToSignal: UserID
}
