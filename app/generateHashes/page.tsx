'use client'

import React, { useState } from 'react'
import axios from 'axios'
import { keccak256, encodePacked } from 'viem'
import { useReadContract } from 'wagmi'

const pinataJWT = process.env.NEXT_PUBLIC_PINATA_JWT!

type Combined = { code: string; uri: string; hash: string }

export default function GenerateHashesTab() {
  /* ───────── local state ───────── */
  const [images, setImages] = useState<File[]>([])
  const [passes, setPasses] = useState('')
const [selectedAddress, setSelectedAddress] = useState<`0x${string}` | undefined>(undefined)

  const [hashesOutput, setHashesOutput] = useState<string[]>([])
  const [combinedOutput, setCombinedOutput] = useState<Combined[]>([])
  const [status, setStatus] = useState('')
  const [metaCID, setMetaCID] = useState<string | null>(null)

  /* ───────── on‑chain look‑ups ───────── */
const nameResult = selectedAddress
  ? useReadContract({
      address: selectedAddress,
      abi: [{ name: 'name', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] }],
      functionName: 'name',
    })
  : { data: undefined }

const symbolResult = selectedAddress
  ? useReadContract({
      address: selectedAddress,
      abi: [{ name: 'symbol', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] }],
      functionName: 'symbol',
    })
  : { data: undefined }

const name = nameResult.data
const symbol = symbolResult.data


  /* ───────── helpers ───────── */
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setImages(Array.from(e.target.files))
  }

  async function handleGenerate() {
    if (!images.length || !passes.trim()) return alert('Upload images and enter passes')
    if (!selectedAddress) return alert('Select a collection address')

    const passList = passes
      .trim()
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)

    if (passList.length !== images.length) return alert('Passes and images count mismatch')

    try {
      /* 1️⃣ Upload images */
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

      /* 2️⃣ Build & upload metadata folder */
      setStatus('Uploading metadata…')
      const folder = 'metadata' // sub‑directory inside root CID
      const metaFD = new FormData()

      passList.forEach((code, i) => {
        const meta = {
          name: `${name} #${i + 1}`,
          description: `Claimed with ${code}`,
          image: imgCIDs[i],
        }
        // important: include directory path in filename
        metaFD.append(
          'file',
          new Blob([JSON.stringify(meta)], { type: 'application/json' }),
          `${folder}/${i}.json`,
        )
      })

      metaFD.append('pinataMetadata', JSON.stringify({ name: 'cardify‑metadata‑folder' }))
      metaFD.append('pinataOptions', JSON.stringify({ wrapWithDirectory: true }))

      const metaRes = await axios.post(
        'https://api.pinata.cloud/pinning/pinFileToIPFS',
        metaFD,
        { headers: { Authorization: `Bearer ${pinataJWT}` } },
      )

      const cid: string = metaRes.data.IpfsHash
      setMetaCID(cid)

      /* 3️⃣ Generate hashes + combined list */
      setStatus('Generating hashes…')
      const hashes = passList.map((code, i) =>
        keccak256(encodePacked(['string', 'string'], [code, `ipfs://${cid}/${folder}/${i}.json`])),
      )

      setHashesOutput(hashes)

      const combined = passList.map<Combined>((code, i) => ({
        code,
        uri: `ipfs://${cid}/${folder}/${i}.json`,
        hash: hashes[i],
      }))
      setCombinedOutput(combined)

      setStatus('✅ Done – copy what you need')
    } catch (err: any) {
      console.error(err)
      setStatus('❌ Failed: ' + (err?.response?.data?.error || err.message))
    }
  }

  /* ───────── UI ───────── */
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Generate Hashes</h2>

      {/* Address selector */}
      <label className="block font-medium">NFT Collection address</label>
      <input
  className="w-full p-2 border rounded"
  placeholder="0x…"
  value={selectedAddress ?? ''}
  onChange={(e) => {
    const value = e.target.value
    setSelectedAddress(value.startsWith('0x') ? (value as `0x${string}`) : undefined)
  }}
/>

      {name && symbol && (
        <p className="text-sm text-gray-600">
          Loaded → <b>{name}</b> ({symbol})
        </p>
      )}

      {/* File + pass inputs */}
      <div>
        <label className="block font-medium">Images</label>
        <input type="file" multiple accept="image/*" onChange={handleImageUpload} />
      </div>

      <div>
        <label className="block font-medium">Pass Codes (one per line)</label>
        <textarea
          className="w-full border p-2 rounded"
          rows={5}
          value={passes}
          onChange={(e) => setPasses(e.target.value)}
        />
      </div>

      <button onClick={handleGenerate} className="px-4 py-2 bg-black text-white rounded">
        Generate & Upload
      </button>

      {/* Status + outputs */}
      {status && <p className="text-sm text-blue-600">{status}</p>}

      {metaCID && (
        <p className="text-sm text-green-700">
          Metadata root CID: <code className="bg-gray-100 px-1 rounded">{metaCID}</code>
        </p>
      )}

      {/* Box 1 – hashes */}
      {hashesOutput.length > 0 && (
        <>
          <h3 className="font-semibold mt-4">Hashes (for addValidHashes)</h3>
          <pre className="whitespace-pre-wrap break-words border p-2 bg-gray-50 rounded">
            {JSON.stringify(hashesOutput, null, 2)}
          </pre>
        </>
      )}

      {/* Box 2 – full records */}
      {combinedOutput.length > 0 && (
        <>
          <h3 className="font-semibold mt-4">Code / URI / Hash</h3>
          <pre className="whitespace-pre-wrap break-words border p-2 bg-gray-50 rounded">
            {JSON.stringify(combinedOutput, null, 2)}
          </pre>
        </>
      )}
    </div>
  )
}
