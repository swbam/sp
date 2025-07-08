import { Header } from '@/components/Header';
import { SearchInput } from '@/components/SearchInput';

import { SearchContent } from './components/SearchContent';

export const revalidate = 0;

interface SearchProps {
  searchParams: {
    q: string;
  };
}

const Search = async ({ searchParams }: SearchProps) => {
  return (
    <div
      className="
        bg-neutral-900
        rounded-lg
        h-full
        w-full
        overflow-hidden
        overflow-y-auto
        "
    >
      <Header className="from-bg-neutral-900">
        <div className="mb-2 flex flex-col gap-y-6">
          <h1 className="text-white text-3xl font-semibold">Search Artists</h1>
          <SearchInput />
        </div>
      </Header>
      <SearchContent searchQuery={searchParams.q} />
    </div>
  );
};

export default Search;
