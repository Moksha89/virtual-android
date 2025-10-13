import { useState } from 'react'
import { InstanceCreator } from './components/InstanceCreator'
import { AndroidScreen } from './components/AndroidScreen'
import './App.css'

function App() {
  const [instanceId, setInstanceId] = useState<string | null>(null)
  
  const handleInstanceCreated = (id: string) => {
    setInstanceId(id)
  }
  
  const handleInstanceDeleted = () => {
    setInstanceId(null)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Virtual Android
          </h1>
          <p className="text-gray-600">
            Create and interact with virtual Android phones in your browser
          </p>
        </div>
        
        <div className="flex gap-8 justify-center items-start flex-wrap">
          {!instanceId ? (
            <InstanceCreator onInstanceCreated={handleInstanceCreated} />
          ) : (
            <AndroidScreen 
              instanceId={instanceId} 
              onDelete={handleInstanceDeleted}
            />
          )}
        </div>
        
        <footer className="mt-12 text-center text-sm text-gray-500">
          <p>Phase 1: Basic instance management and input forwarding</p>
          <p className="mt-1">Phase 2: WebRTC streaming, camera access, VoIP integration</p>
        </footer>
      </div>
    </div>
  )
}

export default App
