import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import Navbar from './components/landing/Navbar'
import Hero from './components/landing/Hero'
import About from './components/landing/About'
import ProductShowcase from './components/landing/ProductShowcase'
import Action from './components/landing/Action'
import Journey from './components/landing/Journey'
import FAQ from './components/landing/FAQ'
import Footer from './components/landing/Footer'
import { scrollToLandingSection } from './lib/landingNavigation'
import './styles/landing.css'

function LandingHashNavigation() {
  const { hash } = useLocation()

  useEffect(() => {
    if (!hash) return

    let targetId = hash.slice(1)
    try {
      targetId = decodeURIComponent(targetId)
    } catch {
      // Keep the literal fragment for malformed external links.
    }

    scrollToLandingSection(targetId)
  }, [hash])

  return null
}

export default function App() {
  return (
    <>
      <LandingHashNavigation />
      <Navbar />
      <main id="top">
        <Hero />
        <About />
        <ProductShowcase />
        <Action />
        <Journey />
      </main>
      <FAQ />
      <Footer />
    </>
  )
}
