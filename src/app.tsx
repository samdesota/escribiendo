import '@unocss/reset/tailwind.css';
import 'virtual:uno.css';
import './styles/journal.css';

import { Router } from '@solidjs/router';
import { FileRoutes } from '@solidjs/start/router';
import { Suspense } from 'solid-js';
import { MetaProvider } from '@solidjs/meta';
import Nav from '~/components/Nav';

export default function App() {
  return (
    <MetaProvider>
      <Router
        root={props => (
          <div class='h-screen flex flex-col'>
            <Nav />
            <div class='flex-1 overflow-hidden'>
              <Suspense>{props.children}</Suspense>
            </div>
          </div>
        )}
      >
        <FileRoutes />
      </Router>
    </MetaProvider>
  );
}
