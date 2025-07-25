'use client'

import React, { useState, useEffect } from 'react'
import { usePrivy } from '@privy-io/react-auth'
import {
  useReadContract,
  useWriteContract,
  useWalletClient,
  useAccount,
  usePublicClient,
} from 'wagmi'
import { parseEther, formatEther, keccak256, toBytes, encodePacked, parseEventLogs } from 'viem'
import Link from 'next/link'

// ────────────────────────────────────────────────────────────────────────────────
// Factory contract
// ────────────────────────────────────────────────────────────────────────────────
const factoryAddress = process.env.NEXT_PUBLIC_FACTORY_ADDRESS as `0x${string}`
const factoryAbi = [
  /* ─── functions ─── */
  {
    name: 'createCollection',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'name',               type: 'string'  },
      { name: 'symbol',             type: 'string'  },
      { name: 'price',              type: 'uint256' },
      { name: 'royaltyRecipient',   type: 'address' },
      { name: 'royaltyPercentage',  type: 'uint96'  },
    ],
    outputs: [{ name: 'collectionAddress', type: 'address' }],
  },
  {
    name: 'getUserCollections',
    type: 'function',
    stateMutability: 'view',
    inputs : [{ name: 'user', type: 'address' }],
    outputs: [{ type: 'address[]' }],
  },

  /* ─── event we forgot ─── */
  {
    anonymous: false,
    name : 'CollectionDeployed',
    type : 'event',
    inputs: [
      { indexed: true,  name: 'creator',           type: 'address' },
      { indexed: false, name: 'collectionAddress', type: 'address' },
      { indexed: false, name: 'name',              type: 'string'  },
      { indexed: false, name: 'symbol',            type: 'string'  },
      { indexed: false, name: 'mintPrice',         type: 'uint256' },
      { indexed: false, name: 'royaltyRecipient',  type: 'address' },
      { indexed: false, name: 'royaltyPercentage', type: 'uint96'  },
    ],
  },
] as const


// Minimal ABI for CardifyNFT metadata + admin
const nftAbi = [
  { name: 'name', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { name: 'symbol', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { name: 'mintPrice', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  {
    name: 'addValidHashes',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'hashes', type: 'bytes32[]' }],
    outputs: [],
  },
  {
    name: 'owner',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
] as const

// ────────────────────────────────────────────────────────────────────────────────
// Dashboard Page
// ────────────────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { ready, authenticated, user, login, logout } = usePrivy()
  const [tab, setTab] = useState<'deploy' | 'mine'>('deploy')
  const [collections, setCollections] = useState<string[]>([])
  const [txHash, setTxHash] = useState<string | null>(null)

  // factory query
const userAddress =
  authenticated && user?.wallet?.address?.startsWith('0x')
    ? (user.wallet.address as `0x${string}`)
    : undefined

const { data: collectionsData, refetch } = useReadContract(
  userAddress
    ? {
        address: factoryAddress,
        abi: factoryAbi,
        functionName: 'getUserCollections',
        args: [userAddress],
      }
    : { address: factoryAddress, abi: factoryAbi, functionName: 'getUserCollections', args: ['0x0000000000000000000000000000000000000000'] }
)


  useEffect(() => {
    if (collectionsData) setCollections(collectionsData as string[])
  }, [collectionsData])

  if (!ready) return null

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800">
      {/* Header */}
      <header className="bg-white shadow p-4 flex justify-between">
        <h1 className="font-semibold text-lg">Cardify Collections</h1>
        {!authenticated ? (
          <button className="px-4 py-2 rounded bg-black text-white" onClick={login}>
            Connect
          </button>
        ) : (
          <button className="px-4 py-2 rounded bg-gray-200" onClick={logout}>
            Logout
          </button>
        )}
      </header>

      {authenticated && (
        <main className="max-w-4xl mx-auto p-6">
          {/* Tabs */}
          <div className="flex space-x-4 mb-6">
            <Tab label="Deploy" active={tab === 'deploy'} onClick={() => setTab('deploy')} />
            <Tab
              label="My Collections"
              active={tab === 'mine'}
              onClick={() => {
                setTab('mine')
                refetch()
              }}
            />
                     <Link href="/generateHashes">
    <button className="px-4 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700">
      Generate Hashes
    </button>
  </Link>
          </div>

          {tab === 'deploy' && <DeployForm onDeployed={(hash) => { setTxHash(hash); refetch() }} />}
          {tab === 'mine' && <MyCollections addresses={collections} viewer={user!.wallet!.address!} />}
  

          {txHash && (
            <p className="mt-4 text-sm">
              Tx submitted:&nbsp;
              <a
                className="underline"
                href={`https://sepolia.etherscan.io/tx/${txHash}`}
                target="_blank"
                rel="noreferrer"
              >
                {txHash.slice(0, 10)}…
              </a>
            </p>
          )}
        </main>
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────────
// Components
// ────────────────────────────────────────────────────────────────────────────────
function Tab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded transition ${active ? 'bg-black text-white' : 'bg-gray-200 text-gray-700'}`}
    >
      {label}
    </button>
  )
}

function DeployForm({ onDeployed }: { onDeployed: (hash: string) => void }) {
 const [name,             setName]   = useState('')
  const [symbol,           setSymbol] = useState('')
  const [price,            setPrice]  = useState('')
  const [royaltyRecipient, setRoyaltyRecipient] = useState('')
  const [royaltyPct,       setRoyaltyPct] = useState('')

  /* ───── hooks ───── */
  const { user }                  = usePrivy()              // gives Supabase user_id
  const { isConnected }           = useAccount()
  const { data: walletClient }    = useWalletClient()
  const { writeContractAsync }    = useWriteContract()
  const  publicClient             = usePublicClient()

  

async function handleSubmit(e: React.FormEvent) {
  e.preventDefault()
  if (!isConnected || !walletClient || !publicClient) {
    alert('Wallet or client not ready')
    return
  }

  /* 1️⃣  send tx ------------------------------------------------------------ */
  const txHash = await writeContractAsync({
    account      : walletClient.account,
    address      : factoryAddress,
    abi          : factoryAbi,
    functionName : 'createCollection',
    args: [
      name,
      symbol,
      BigInt(parseEther(price || '0')),
      royaltyRecipient as `0x${string}`,
      BigInt(royaltyPct || '0'),
    ],
  })

  /* 2️⃣  wait for inclusion ------------------------------------------------- */
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash })

  /* 3️⃣  extract the CollectionDeployed event ------------------------------ */
  const events = parseEventLogs({
    abi       : factoryAbi,                 // now includes CollectionDeployed
    logs      : receipt.logs,
    eventName : 'CollectionDeployed',
  })

  const collectionAddress =
    events[0].args.collectionAddress as `0x${string}`

  /* 4️⃣  save in Supabase --------------------------------------------------- */
  await fetch('/api/collections', {
    method : 'POST',
    body   : JSON.stringify({
      address : collectionAddress.toLowerCase(),
      owner   : walletClient.account.address.toLowerCase(),
    }),
  })

  /* 5️⃣  notify parent + reset form ---------------------------------------- */
  onDeployed(txHash)
  setName('')
  setSymbol('')
  setPrice('')
  setRoyaltyRecipient('')
  setRoyaltyPct('')
}



return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <input  required value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Name"  className="p-3 border rounded" />

        <input  required value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                placeholder="Symbol" className="p-3 border rounded" />

        <input  required type="number" step="0.0001" value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="Mint Price (ETH)" className="p-3 border rounded" />

        <input  required value={royaltyRecipient}
                onChange={(e) => setRoyaltyRecipient(e.target.value)}
                placeholder="Royalty Recipient" className="p-3 border rounded" />

        <input  required type="number" value={royaltyPct}
                onChange={(e) => setRoyaltyPct(e.target.value)}
                placeholder="Royalty % (e.g. 250)" className="p-3 border rounded col-span-2" />
      </div>

      <button type="submit"
              disabled={!isConnected}
              className="px-6 py-3 bg-black text-white rounded w-full disabled:opacity-50">
        {isConnected ? 'Deploy Collection' : 'Connect Wallet'}
      </button>
    </form>
  )
}

interface CollectionRowProps {
  addr: `0x${string}`
  viewer: string
}

function CollectionRow({ addr, viewer }: CollectionRowProps) {
  const publicClient = usePublicClient()
  const { data: name } = useReadContract({ address: addr, abi: nftAbi, functionName: 'name' })
  const { data: symbol } = useReadContract({ address: addr, abi: nftAbi, functionName: 'symbol' })
  const { data: price } = useReadContract({ address: addr, abi: nftAbi, functionName: 'mintPrice' })
  const { data: owner } = useReadContract({ address: addr, abi: nftAbi, functionName: 'owner' })
  const isOwner = owner?.toLowerCase() === viewer.toLowerCase()

  const [pushing, setPushing] = useState(false)
  const [open, setOpen] = useState(false)
  const [pairsInput, setPairsInput] = useState('')
  const { writeContractAsync, isPending } = useWriteContract()

  async function handleAddToFrontend() {
    try {
      setPushing(true)
      const res = await fetch(`/api/collections/${addr.toLowerCase()}`)
      if (!res.ok) throw new Error(await res.text())
      const { cid } = await res.json()
      if (!cid) throw new Error('No CID saved for this collection')

     const fe = await fetch(`/api/collections/${addr.toLowerCase()}/activate`, {
   method : 'PUT',
   headers: { 'Content-Type': 'application/json' },
   body   : JSON.stringify({ cid }),
 });

      if (!fe.ok) throw new Error((await fe.json()).error || 'Frontend rejected')

      alert('✅ Collection sent to frontend')
    } catch (err: any) {
      alert(err.message)
    } finally {
      setPushing(false)
    }
  }

  async function handleAddHashes() {
    try {
      const raw = pairsInput.trim()
      let list: string[] = raw.startsWith('[')
        ? JSON.parse(raw).map((h: string) => h.trim())
        : raw.split('\n').map((l) => l.trim()).filter(Boolean)

      const hashes = list.map((item) => {
        const cleaned = item.replace(/^[,"\[\]\s]+|[,"\[\]\s]+$/g, '').toLowerCase()
        if (cleaned.startsWith('0x') && cleaned.length === 66) return cleaned as `0x${string}`
        const [code, uri] = item.split(',').map((s) => s.trim())
        if (!code || !uri) throw new Error(`Bad line: “${item}”`)
        return keccak256(encodePacked(['string', 'string'], [code, uri]))
      })

      const tx = await writeContractAsync({
        address: addr,
        abi: nftAbi,
        functionName: 'addValidHashes',
        args: [hashes],
      })

      setPairsInput('')
      setOpen(false)
      alert(`✅ Hashes added. Tx: ${tx}`)
    } catch (err: any) {
      alert(err.message || 'Tx failed')
    }
  }

  return (
    <li className="bg-white p-5 rounded-xl shadow-sm border space-y-3">
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold text-gray-800">
            {name ?? '…'} <span className="text-gray-500">({symbol ?? '…'})</span>
          </h3>
          <p className="text-sm text-gray-500 break-all">
            <span className="font-medium">Address:</span> {addr}
          </p>
          <p className="text-sm text-gray-500">
            <span className="font-medium">Price:</span> {price ? formatEther(price as bigint) : '…'} ETH
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <a
            href={`https://sepolia.etherscan.io/address/${addr}`}
            target="_blank"
            rel="noreferrer"
            className="text-blue-600 hover:underline text-sm font-medium"
          >
            View on Etherscan
          </a>
          {isOwner && (
            <>
              <button
                onClick={() => setOpen(!open)}
                className="text-sm px-3 py-1 rounded bg-gray-100 hover:bg-gray-200"
              >
                {open ? 'Cancel' : 'Add Hashes'}
              </button>
              <button
                onClick={handleAddToFrontend}
                disabled={pushing}
                className="text-sm px-3 py-1 rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {pushing ? 'Sending…' : 'Add to Frontend'}
              </button>
            </>
          )}
        </div>
      </div>

      {open && isOwner && (
        <div className="pt-2">
          <textarea
            rows={4}
            value={pairsInput}
            onChange={(e) => setPairsInput(e.target.value)}
            placeholder="Paste hash array or code,uri pairs here"
            className="w-full border rounded p-3 text-sm font-mono bg-gray-50"
          />
          <div className="text-right mt-2">
            <button
              onClick={handleAddHashes}
              disabled={isPending}
              className="px-5 py-2 bg-black text-white text-sm rounded hover:bg-gray-900 disabled:opacity-50"
            >
              {isPending ? 'Submitting…' : 'Submit Hashes'}
            </button>
          </div>
        </div>
      )}
    </li>
  )
}

function MyCollections({ addresses, viewer }: { addresses: string[]; viewer: string }) {
  if (!addresses.length)
    return <p className="text-gray-500 text-sm mt-4">No collections deployed yet.</p>

  return (
    <ul className="space-y-6">
      {addresses.map((addr) => (
        <CollectionRow key={addr} addr={addr as `0x${string}`} viewer={viewer} />
      ))}
    </ul>
  )
}

