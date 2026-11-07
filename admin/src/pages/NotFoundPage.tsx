import { ButtonLink } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/States';

export default function NotFoundPage() {
  return (
    <div className="page">
      <EmptyState
        icon="search"
        title="This page doesn’t exist"
        message="The link may be old or mistyped. Use the menu to find what you need, or go back to the overview."
        action={
          <ButtonLink to="/" variant="primary" icon="home">
            Go to overview
          </ButtonLink>
        }
      />
    </div>
  );
}
