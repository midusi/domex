import { ENVS } from '@/constants/envs'
import RoomContext from '@/context/RoomContext'
import { socket } from '@/socket'
import { UserID } from '@/types'
import { getIceServers } from '@/utils/iceServers'
import { useCallback, useContext } from 'react'
import SimplePeer, { SignalData } from 'simple-peer'

const CHUNK_SIZE = ENVS.GENERAL.CHUNK_SIZE

const usePeers = () => {
  const { peers, setPeers } = useContext(RoomContext)

  const destroyPeers = useCallback(() => {
    const peersValues = Object.values(peers)

    peersValues.forEach((peer) => {
      peer.destroy()
    })
    setPeers({})
  }, [peers, setPeers])

  const deletePeer = useCallback(
    (userID: UserID) => {
      peers[userID]?.destroy()
      setPeers((peers) => {
        const newPeers = { ...peers }
        delete newPeers[userID]
        return newPeers
      })
    },
    [peers, setPeers],
  )

  const sendDirectMessage = useCallback(
    (userID: UserID, data: any) => {
      const peer = peers[userID]
      if (!peer) return 0

      const dataString = JSON.stringify(data)
      const dataBuffer = Buffer.from(dataString, 'utf8')

      const totalChunks = Math.ceil(dataBuffer.length / CHUNK_SIZE)
      let sentBytes = 0

      for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE
        const end = (i + 1) * CHUNK_SIZE
        const chunk = dataBuffer.subarray(start, end)
        const chunkHeader = JSON.stringify({ type: 'CHUNK', totalChunks, chunkIndex: i })
        peer.write(Buffer.concat([Buffer.from(chunkHeader), chunk]))
        sentBytes += chunk.length
      }

      return sentBytes
    },
    [peers],
  )

  const sendFile = useCallback(
    async (userID: UserID, file: File) => {
      const peer = peers[userID]

      if (!peer) return

      sendDirectMessage(userID, { type: 'FILE_NAME', payload: file.name })

      const fileBuffer = await file.arrayBuffer()
      const totalSize = fileBuffer.byteLength
      let offset = 0

      while (offset < totalSize) {
        const chunk = fileBuffer.slice(offset, offset + CHUNK_SIZE)
        peer.write(Buffer.from(chunk))
        offset += CHUNK_SIZE
      }

      console.log('File sent successfully:', file.name)
    },
    [peers, sendDirectMessage],
  )

  const broadcastMessage = useCallback(
    (data: any) => {
      Object.keys(peers).forEach((userID) => {
        sendDirectMessage(userID as UserID, data)
      })
    },
    [peers, sendDirectMessage],
  )

  const createPeer = useCallback((userToSignal: UserID, callerID: UserID) => {
    const peer = new SimplePeer({
      initiator: true,
      trickle: false,
      config: {
        iceServers: getIceServers(),
      },
    })

    peer.on('signal', (signal) => {
      socket.emit('webrtc:sending-signal', { userToSignal, callerID, signal })
    })

    return peer
  }, [])

  const addPeer = useCallback((incomingSignal: SignalData, callerID: UserID) => {
    const peer = new SimplePeer({
      initiator: false,
      trickle: false,
      config: {
        iceServers: getIceServers(),
      },
    })

    peer.on('signal', (signal) => {
      socket.emit('webrtc:returning-signal', { signal, callerID })
    })

    peer.signal(incomingSignal)

    return peer
  }, [])

  return {
    deletePeer,
    sendDirectMessage,
    createPeer,
    destroyPeers,
    addPeer,
    peers,
    broadcastMessage,
    sendFile,
  }
}

export default usePeers
