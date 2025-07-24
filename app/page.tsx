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
import { parseEther, formatEther, keccak256, toBytes } from 'viem'
import Link from 'next/link'

// ────────────────────────────────────────────────────────────────────────────────
// Factory contract
// ────────────────────────────────────────────────────────────────────────────────
const factoryAddress = process.env.NEXT_PUBLIC_FACTORY_ADDRESS as `0x${string}`
const factoryAbi = [
  {
    name: 'createCollection',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'name', type: 'string' },
      { name: 'symbol', type: 'string' },
      { name: 'price', type: 'uint256' },
      { name: 'royaltyRecipient', type: 'address' },
      { name: 'royaltyPercentage', type: 'uint96' },
    ],
    outputs: [{ name: 'collectionAddress', type: 'address' }],
  },
  {
    name: 'getUserCollections',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ type: 'address[]' }],
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
  const [name, setName] = useState('')
  const [symbol, setSymbol] = useState('')
  const [price, setPrice] = useState('')
  const [royaltyRecipient, setRoyaltyRecipient] = useState('')
  const [royaltyPct, setRoyaltyPct] = useState('')

  const { data: walletClient } = useWalletClient()
  const { isConnected } = useAccount()
  const { writeContractAsync } = useWriteContract()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isConnected || !walletClient) return alert('Connect wallet first')

    const hash = await writeContractAsync({
      account: walletClient.account,
      address: factoryAddress,
      abi: factoryAbi,
      functionName: 'createCollection',
      args: [
        name,
        symbol,
        BigInt(parseEther(price)),
        royaltyRecipient as `0x${string}`,
        BigInt(royaltyPct),
      ],
    })

    onDeployed(hash as string)
    setName('')
    setSymbol('')
    setPrice('0')
    setRoyaltyRecipient('')
    setRoyaltyPct('0')
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className="p-3 border rounded" />
        <input required value={symbol} onChange={(e) => setSymbol(e.target.value)} placeholder="Symbol" className="p-3 border rounded" />
        <input required type="number" step="0.0001" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Mint Price (ETH)" className="p-3 border rounded" />
        <input required value={royaltyRecipient} onChange={(e) => setRoyaltyRecipient(e.target.value)} placeholder="Royalty Recipient" className="p-3 border rounded" />
        <input required type="number" value={royaltyPct} onChange={(e) => setRoyaltyPct(e.target.value)} placeholder="Royalty % (e.g. 250)" className="p-3 border rounded col-span-2" />
      </div>
      <button type="submit" className="px-6 py-3 bg-black text-white rounded w-full disabled:opacity-50" disabled={!isConnected}>
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

  // add‑hashes form state
  const [open, setOpen] = useState(false)
  const [pairsInput, setPairsInput] = useState('') // code,uri per line
  const { writeContractAsync, isPending } = useWriteContract()
  const isOwner = owner?.toLowerCase() === viewer.toLowerCase()


  /* ───────── inside CollectionRow ───────── */
async function handleAddHashes() {
  try {
    // 1️⃣ normalise the textarea content into *pure* 0x‑hex strings
    const raw = pairsInput.trim()

    // a) user pasted the JSON array from “Hashes” box
    //    e.g. ["0xabc…","0xdef…"]
    let list: string[]
    if (raw.startsWith('[')) {
      list = JSON.parse(raw).map((h: string) => h.trim())
    } else {
      // b) line‑by‑line: either   0x…    or   CODE,uri
      list = raw.split('\n').map((l) => l.trim()).filter(Boolean)
    }

    // 2️⃣ build the final bytes32[]
    const hashes = list.map((item) => {
      // i. already a clean 0x hash
      const cleaned = item
        .replace(/^[,"\[\]\s]+|[,"\[\]\s]+$/g, '') // strip quotes, commas, brackets
        .toLowerCase()

      if (cleaned.startsWith('0x') && cleaned.length === 66) return cleaned as `0x${string}`

      // ii. CODE,uri → derive on the fly
      const [code, uri] = item.split(',').map((s) => s.trim())
      if (!code || !uri) throw new Error(`Bad line: “${item}”`)
      return keccak256(encodePacked(['string', 'string'], [code, uri]))
    })

    if (!hashes.length) throw new Error('No valid hashes found')

    const hash = await writeContractAsync({
      address: addr,
      abi: nftAbi,
      functionName: 'addValidHashes',
      args: [hashes],
    })

    setPairsInput('')
    setOpen(false)
    alert(`Hashes added! Tx: ${hash}`)
  } catch (err: any) {
    alert(err?.message || 'Tx failed')
  }
}


  return (
    <li className="border rounded p-4">
      <div className="flex items-center justify-between">
        <div>
    <h3 className="font-medium">
  {name ?? '…'} ({symbol ?? '…'})
</h3>
<p className="text-sm text-gray-600">
  Address: <span className="font-mono text-xs">{addr}</span>
</p>
<p className="text-sm text-gray-600">
  Price: {price ? formatEther(price as bigint) : '…'} ETH
</p>

        </div>
        <div className="flex items-center gap-3">
          <a href={`https://sepolia.etherscan.io/address/${addr}`} target="_blank" rel="noreferrer" className="underline text-sm">
            View
          </a>
          {isOwner && (
            <button onClick={() => setOpen((v) => !v)} className="text-sm bg-gray-200 px-3 py-1 rounded">
              {open ? 'Cancel' : 'Add Hashes'}
            </button>
          )}
        </div>
      </div>

      {open && isOwner && (
        <div className="mt-3 space-y-2">
          <textarea
            rows={4}
            value={pairsInput}
            onChange={(e) => setPairsInput(e.target.value)}
            placeholder={'generate hashes and paste them here'}
            className="w-full border p-2 rounded text-sm"
          />
          <button
            onClick={handleAddHashes}
            disabled={isPending}
            className="px-4 py-2 bg-black text-white rounded disabled:opacity-50"
          >
            {isPending ? 'Submitting…' : 'Submit Hashes'}
          </button>
        </div>
      )}
    </li>
  )
}

function MyCollections({ addresses, viewer }: { addresses: string[]; viewer: string }) {
  if (!addresses.length) return <p>No collections yet.</p>
  return (
    <ul className="space-y-4">
      {addresses.map((addr) => (
        <CollectionRow key={addr} addr={addr as `0x${string}`} viewer={viewer} />
      ))}
    </ul>
  )
}
