"use client"

import React, { createContext, useCallback, useContext, useState, useEffect } from 'react'
import type { CartItem } from '@/lib/types'

interface CartContextType {
  items: CartItem[]
  addItem: (item: Omit<CartItem, 'quantity'> & { quantity?: number }) => void
  removeItem: (id: string, color: string, size: string) => void
  updateQuantity: (id: string, color: string, size: string, quantity: number) => void
  clearCart: () => void
  getItemCount: () => number
  getTotalPrice: () => number
}

const CartContext = createContext<CartContextType | undefined>(undefined)

export const useCart = () => {
  const context = useContext(CartContext)
  if (!context) {
    throw new Error('useCart must be used within a CartProvider')
  }
  return context
}

export const CartProvider = ({ children }: { children: React.ReactNode }) => {
  const [items, setItems] = useState<CartItem[]>(() => {
    if (typeof window === 'undefined') return []
    const storedItems = localStorage.getItem('cart-items')
    return storedItems ? JSON.parse(storedItems) : []
  })

  // Update localStorage whenever items change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('cart-items', JSON.stringify(items))
    }
  }, [items])

  const addItem = (newItem: Omit<CartItem, 'quantity'> & { quantity?: number }) => {
    const qtyToAdd = newItem.quantity ?? 1
    setItems(prevItems => {
      const existingItem = prevItems.find(
        item => item.id === newItem.id && item.color === newItem.color && item.size === newItem.size
      )

      if (existingItem) {
        return prevItems.map(item =>
          item.id === newItem.id && item.color === newItem.color && item.size === newItem.size
            ? { ...item, quantity: item.quantity }
            : item
        )
      } else {
        const itemToAdd: CartItem = { ...newItem, quantity: qtyToAdd }
        // Ensure we don't keep an undefined quantity property on newItem
        return [...prevItems, itemToAdd]
      }
    })
  }

  const removeItem = (id: string, color: string, size: string) => {
    setItems(prevItems => 
      prevItems.filter(item => 
        !(item.id === id && item.color === color && item.size === size)
      )
    )
  }

  const updateQuantity = (id: string, color: string, size: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(id, color, size)
      return
    }

    setItems(prevItems =>
      prevItems.map(item =>
        item.id === id && item.color === color && item.size === size
          ? { ...item, quantity }
          : item
      )
    )
  }

  const clearCart = useCallback(() => setItems([]), [])

  const getItemCount = () => {
    return items.reduce((total, item) => total + item.quantity, 0)
  }

  const getTotalPrice = () => {
    return items.reduce((total, item) => total + (item.price * item.quantity* (item.unit_quantity||1)), 0)
  }

  return (
    <CartContext.Provider value={{
      items,
      addItem,
      removeItem,
      updateQuantity,
      clearCart,
      getItemCount,
      getTotalPrice
    }}>
      {children}
    </CartContext.Provider>
  )
}
