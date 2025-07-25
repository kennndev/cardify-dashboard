'use client'

import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { keccak256, encodePacked } from 'viem'
import { useReadContract } from 'wagmi'

const pinataJWT = process.env.NEXT_PUBLIC_PINATA_JWT!

type Combined = { code: string; uri: string; hash: string }

export default function GenerateHashesTab() {
  const [images, setImages] = useState<File[]>([])
  const [passes, setPasses] = useState('')
  const [addressInput, setAddressInput] = useState('')
  const [selectedAddress, setSelectedAddress] = useState<`0x${string}` | undefined>(undefined)
  const [hashesOutput, setHashesOutput] = useState<string[]>([])
  const [combinedOutput, setCombinedOutput] = useState<Combined[]>([])
  const [status, setStatus] = useState('')
  const [metaCID, setMetaCID] = useState<string | null>(null)

  useEffect(() => {
    const v = addressInput.trim()
    setSelectedAddress(v.startsWith('0x') && v.length === 42 ? (v as `0x${string}`) : undefined)
  }, [addressInput])

  const nameResult = useReadContract(
    selectedAddress
      ? {
          address: selectedAddress,
          abi: [{ name: 'name', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] }],
          functionName: 'name',
        }
      : undefined,
  )
  const symbolResult = useReadContract(
    selectedAddress
      ? {
          address: selectedAddress,
          abi: [{ name: 'symbol', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] }],
          functionName: 'symbol',
        }
      : undefined,
  )

  const name  = nameResult.data
  const symbol = symbolResult.data

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setImages(Array.from(e.target.files))
  }

  async function handleGenerate() {
    if (!images.length || !passes.trim()) return alert('Upload images and enter passes')
    if (!selectedAddress) return alert('Enter a valid 0x address (42 chars)')

    const passList = passes.trim().split('\n').map(l => l.trim()).filter(Boolean)
    if (passList.length !== images.length) return alert('Passes and images count mismatch')

    try {
      setStatus('Uploading images…')
      const imgCIDs: string[] = []
      for (const file of images) {
        const fd = new FormData()
        fd.append('file', file, file.name)
        const { data } = await axios.post('https://api.pinata.cloud/pinning/pinFileToIPFS', fd, {
          headers: { Authorization: `Bearer ${pinataJWT}` },
        })
        imgCIDs.push(`ipfs://${data.IpfsHash}`)
      }

      setStatus('Uploading metadata…')
      const folder = 'metadata'
      const metaFD = new FormData()
      passList.forEach((code, i) => {
        const meta = { name: `${name} #${i + 1}`, description: `Claimed with ${code}`, image: imgCIDs[i] }
        metaFD.append('file', new Blob([JSON.stringify(meta)], { type: 'application/json' }), `${folder}/${i}.json`)
      })
      metaFD.append('pinataMetadata', JSON.stringify({ name: 'cardify‑metadata‑folder' }))
      metaFD.append('pinataOptions',  JSON.stringify({ wrapWithDirectory: true }))

      const metaRes  = await axios.post('https://api.pinata.cloud/pinning/pinFileToIPFS', metaFD, {
        headers: { Authorization: `Bearer ${pinataJWT}` },
      })
      const cid: string = metaRes.data.IpfsHash
      setMetaCID(cid)

      await fetch(`/api/collections/${selectedAddress.toLowerCase()}`, {
        method : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify({ cid, owner: selectedAddress.toLowerCase() }),
      })

      setStatus('Generating hashes…')
      const hashes = passList.map((code, i) =>
        keccak256(encodePacked(['string', 'string'], [code, `ipfs://${cid}/metadata/${i}.json`])),
      )
      setHashesOutput(hashes)
      setCombinedOutput(passList.map((code, i) => ({
        code,
        uri: `ipfs://${cid}/metadata/${i}.json`,
        hash: hashes[i]
      })))
      setStatus('✅ Done – copy what you need')
    } catch (err: any) {
      console.error(err)
      setStatus('❌ Failed: ' + (err?.response?.data?.error || err.message))
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6 bg-white shadow rounded-lg">
      <h2 className="text-2xl font-bold text-center text-gray-800">🎯 Generate Hashes for Your NFT Collection</h2>

      <div className="space-y-2">
        <label className="block font-medium">NFT Collection Address</label>
        <input
          className="w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="0x…"
          value={addressInput}
          onChange={(e) => setAddressInput(e.target.value)}
        />
        {name && symbol && (
          <p className="text-sm text-green-700">
            Loaded Collection: <b>{name}</b> ({symbol})
          </p>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="block font-medium">Upload Images</label>
          <input
            type="file"
            multiple
            accept="image/*"
            className="w-full"
            onChange={handleImageUpload}
          />
        </div>

        <div className="space-y-2">
          <label className="block font-medium">Pass Codes (one per line)</label>
          <textarea
            className="w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={5}
            value={passes}
            onChange={(e) => setPasses(e.target.value)}
          />
        </div>
      </div>

      <div className="text-center">
        <button
          onClick={handleGenerate}
          className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow"
        >
          🚀 Generate & Upload
        </button>
      </div>

      {status && (
        <div className="text-sm text-center font-medium text-blue-600">
          {status}
        </div>
      )}

      {metaCID && (
        <div className="text-sm text-center text-green-700">
          ✅ Metadata root CID: <code className="bg-gray-100 px-2 py-1 rounded">{metaCID}</code>
        </div>
      )}

      {hashesOutput.length > 0 && (
        <div>
          <h3 className="font-semibold text-lg mt-6 mb-2">🧮 Hashes (for `addValidHashes`)</h3>
          <pre className="whitespace-pre-wrap break-words border p-3 bg-gray-50 rounded-md text-sm overflow-x-auto">
            {JSON.stringify(hashesOutput, null, 2)}
          </pre>
        </div>
      )}

      {combinedOutput.length > 0 && (
        <div>
          <h3 className="font-semibold text-lg mt-6 mb-2">📦 Code / URI / Hash</h3>
          <pre className="whitespace-pre-wrap break-words border p-3 bg-gray-50 rounded-md text-sm overflow-x-auto">
            {JSON.stringify(combinedOutput, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}
