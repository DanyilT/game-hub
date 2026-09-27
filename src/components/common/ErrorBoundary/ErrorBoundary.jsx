import { Component } from 'react';
import ErrorPage from '../../../pages/ErrorPage/ErrorPage';

/**
 * Shows the 500 error page, instead of a blank screen, when a page crashes while rendering.
 * React logs the error itself. MainLayout keys this by path, so going to another page tries again.
 */
class ErrorBoundary extends Component {
  state = { crashed: false };

  static getDerivedStateFromError() {
    return { crashed: true };
  }

  render() {
    return this.state.crashed ? <ErrorPage status={500} /> : this.props.children;
  }
}

export default ErrorBoundary;
