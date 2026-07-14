import Navbar from './components/landing/Navbar'
import Hero from './components/landing/Hero'
import About from './components/landing/About'
import ProductShowcase from './components/landing/ProductShowcase'
import Action from './components/landing/Action'
import Journey from './components/landing/Journey'
import FAQ from './components/landing/FAQ'
import Footer from './components/landing/Footer'
import './styles/landing.css'

export default function App() {
  return (
    <>
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
