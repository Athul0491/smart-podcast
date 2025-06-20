import type { Session } from '@supabase/supabase-js';

interface AppHeaderProps {
    session: Session;
    onLogout: () => void;
}

export default function AppHeader({ session, onLogout }: AppHeaderProps) {
    const name = session.user.user_metadata?.full_name ?? session.user.email;

    return (
        <header className="app-header">
            <h2 className="app-header__title">Welcome, {name}!</h2>
            {/* <button onClick={onLogout} className="app-header__logout">Logout</button> */}
        </header>
    );
}
