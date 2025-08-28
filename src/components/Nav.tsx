import { useLocation } from '@solidjs/router';

export default function Nav() {
  const location = useLocation();
  const active = (path: string) =>
    path == location.pathname
      ? 'border-sky-600'
      : 'border-transparent hover:border-sky-600';
  return (
    <nav class='bg-sky-800'>
      <ul class='container flex items-center p-3 text-gray-200'>
        <li class={`border-b-2 ${active('/chat')} mx-1.5 sm:mx-6`}>
          <a href='/chat'>Chat</a>
        </li>
        <li class={`border-b-2 ${active('/journal')} mx-1.5 sm:mx-6`}>
          <a href='/journal'>Diario</a>
        </li>
        <li class={`border-b-2 ${active('/conjugation')} mx-1.5 sm:mx-6`}>
          <a href='/conjugation'>Conjugation Drills</a>
        </li>
        <li class={`border-b-2 ${active('/books')} mx-1.5 sm:mx-6`}>
          <a href='/books'>Books</a>
        </li>
      </ul>
    </nav>
  );
}
