import {Component,type ErrorInfo,type ReactNode} from 'react'

export class ErrorBoundary extends Component<{children:ReactNode},{failed:boolean}>{
  state={failed:false}
  static getDerivedStateFromError(){return {failed:true}}
  componentDidCatch(error:Error,info:ErrorInfo){console.error('Nexara workspace render failure',error,info.componentStack)}
  render(){
    if(!this.state.failed)return this.props.children
    return <main className="fatal-error" role="alert"><div className="brand-mark">N</div><p className="eyebrow">Workspace recovery</p><h1>Something did not load correctly.</h1><p>Your data is safe. Reload the workspace to restore the last synced state.</p><div><button className="btn secondary" onClick={()=>this.setState({failed:false})}>Try again</button><button className="btn primary" onClick={()=>location.reload()}>Reload workspace</button></div></main>
  }
}
