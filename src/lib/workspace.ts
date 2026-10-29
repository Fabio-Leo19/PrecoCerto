import { useEffect, useMemo, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db, firebaseError } from './firebase'
import type { PricingInputs } from './pricing'

export type Product = { id: number; name: string; category: string; cost: number; price: number }
export type FeeProfile = { id: number; name: string; commission: number; fee: number; tax: number; demo?: boolean }
export type Workspace = {
  products: Product[]
  profiles: FeeProfile[]
  calc: PricingInputs
  salePrice: number
  scenarioPrices: number[]
}

export const defaultCalc: PricingInputs = {
  cost: 28.4, package: 3.2, freight: 7.5, operational: 4,
  fee: 3.5, commission: 12, tax: 4, discount: 0, desiredProfit: 18,
}

const demonstration: Workspace = {
  products: [
    { id: 1, name: 'Vela Brisa', category: 'Casa', cost: 28.4, price: 64.9 },
    { id: 2, name: 'Caderno Pauta', category: 'Papelaria', cost: 21.5, price: 49 },
    { id: 3, name: 'Ecobag Traço', category: 'Acessórios', cost: 34.8, price: 54.9 },
    { id: 4, name: 'Caneca Horizonte', category: 'Casa', cost: 31.2, price: 38 },
    { id: 5, name: 'Pôster Formas', category: 'Papelaria', cost: 18.3, price: 45 },
  ],
  profiles: [
    { id: 1, name: 'Venda direta', commission: 0, fee: 0, tax: 4, demo: true },
    { id: 2, name: 'Marketplace próprio', commission: 12, fee: 3.5, tax: 4 },
  ],
  calc: defaultCalc, salePrice: 79.9, scenarioPrices: [64.9, 74.9, 84.9],
}

const initialEmpty: Workspace = { products: [], profiles: [], calc: defaultCalc, salePrice: 79.9, scenarioPrices: [64.9, 74.9, 84.9] }
const demoKey = 'precocerto:workspace-demo-v2'
const number = (value: unknown, fallback = 0) => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1e9 ? value : fallback
const label = (value: unknown) => typeof value === 'string' ? value.trim().slice(0, 150) : ''

export function validWorkspace(raw: unknown, fallback: Workspace): Workspace {
  if (!raw || typeof raw !== 'object') return fallback
  const value = raw as Partial<Workspace>
  const products = Array.isArray(value.products) ? value.products.slice(0, 4000).filter((p): p is Product =>
    p && typeof p === 'object' && typeof p.id === 'number' && !!label(p.name) && typeof p.cost === 'number' && typeof p.price === 'number',
  ).map(p => ({ id: number(p.id), name: label(p.name), category: label(p.category) || 'Sem categoria', cost: number(p.cost), price: number(p.price) })) : fallback.products
  const profiles = Array.isArray(value.profiles) ? value.profiles.slice(0, 100).filter((p): p is FeeProfile =>
    p && typeof p === 'object' && typeof p.id === 'number' && !!label(p.name),
  ).map(p => ({ id: number(p.id), name: label(p.name), commission: number(p.commission), fee: number(p.fee), tax: number(p.tax), demo: Boolean(p.demo) })) : fallback.profiles
  const calc = Object.fromEntries(Object.entries(defaultCalc).map(([key, defaultValue]) => [key, number(value.calc?.[key as keyof PricingInputs], defaultValue)])) as PricingInputs
  return {
    products, profiles, calc,
    salePrice: number(value.salePrice, fallback.salePrice),
    scenarioPrices: Array.isArray(value.scenarioPrices) && value.scenarioPrices.length === 3
      ? value.scenarioPrices.map(v => number(v)) : fallback.scenarioPrices,
  }
}

export function useWorkspace(accountMode: 'loading' | 'signedOut' | 'demo' | 'cloud', userId?: string) {
  const identity = accountMode === 'demo' ? 'demo' : accountMode === 'cloud' && userId ? `user:${userId}` : null
  const [workspace, setWorkspace] = useState<Workspace>(demonstration)
  const [loadedIdentity, setLoadedIdentity] = useState<string | null>(null)
  const [saving, setSaving] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [error, setError] = useState('')
  const lastSaved = useRef('')
  const ready = identity !== null && identity === loadedIdentity

  useEffect(() => {
    let active = true
    setLoadedIdentity(null)
    setError('')
    setSaving('idle')
    if (identity === 'demo') {
      let loaded = demonstration
      try {
        const json = localStorage.getItem(demoKey)
        if (json) loaded = validWorkspace(JSON.parse(json), demonstration)
      } catch { /* O navegador pode bloquear o armazenamento. */ }
      setWorkspace(loaded)
      lastSaved.current = JSON.stringify(loaded)
      setLoadedIdentity(identity)
    } else if (identity && userId && db) {
      void (async () => {
        try {
          const snapshot = await getDoc(doc(db, 'users', userId, 'data', 'workspace'))
          if (!active) return
          const loaded = validWorkspace(snapshot.exists() ? snapshot.data().data : undefined, initialEmpty)
          setWorkspace(loaded)
          lastSaved.current = JSON.stringify(loaded)
          setLoadedIdentity(identity)
        } catch (caught) {
          if (active) setError(`Falha ao abrir seus dados: ${firebaseError(caught)}`)
        }
      })()
    }
    return () => { active = false }
  }, [identity, userId])

  useEffect(() => {
    if (!ready || !identity) return
    const payload = JSON.stringify(workspace)
    if (payload === lastSaved.current) return
    setSaving('saving')
    let active = true
    const timer = window.setTimeout(async () => {
      try {
        if (identity === 'demo') localStorage.setItem(demoKey, payload)
        else if (db && userId) await setDoc(doc(db, 'users', userId, 'data', 'workspace'), {
          data: workspace, updatedAt: new Date().toISOString(),
        })
        if (active) { lastSaved.current = payload; setSaving('saved'); setError('') }
      } catch (caught) {
        if (active) { setSaving('error'); setError(`Não foi possível salvar: ${firebaseError(caught)}`) }
      }
    }, 700)
    return () => { active = false; clearTimeout(timer) }
  }, [workspace, ready, identity, userId])

  const update = <K extends keyof Workspace>(key: K): Dispatch<SetStateAction<Workspace[K]>> => value => setWorkspace(prev => ({
    ...prev,
    [key]: typeof value === 'function' ? (value as (arg: Workspace[K]) => Workspace[K])(prev[key]) : value,
  }))

  function restore(backup: unknown) {
    if (!ready) throw new Error('Aguarde o carregamento da sua conta.')
    if (!backup || typeof backup !== 'object' || (backup as { format?: string }).format !== 'precocerto-backup') {
      throw new Error('Este arquivo não é um backup válido do PreçoCerto.')
    }
    const record = backup as { data?: unknown }
    if (!record.data || typeof record.data !== 'object' || !Array.isArray((record.data as Workspace).products)) {
      throw new Error('O arquivo não contém um catálogo válido.')
    }
    setWorkspace(validWorkspace(record.data, initialEmpty))
  }

  return useMemo(() => ({
    ...workspace, ready, saving, error,
    restore,
    setProducts: update('products'),
    setProfiles: update('profiles'),
    setCalc: update('calc'),
    setSalePrice: update('salePrice'),
    setScenarioPrices: update('scenarioPrices'),
  }), [workspace, ready, saving, error])
}
