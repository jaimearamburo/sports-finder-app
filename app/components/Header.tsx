//import { SearchFiltersContextProvider } from "../store/SearchFiltersContext";

export default function Header() {
  return (
    <header className="w-full md:border-b border-gray-100 bg-white sm:p-2 md:px-4 md:py-4">
      <div className="flex max-w-7xl mx-auto items-center w-full">
        
        {/* Left Section: Logo + Location */}
        <div className="hidden md:flex items-center gap-4">
          {/* App Logo or Name */}
          <span className="hidden md:block font-bold text-xl">Sports Finder</span>

          {/* Location (hidden on small screens) */}
          {/* <div className="hidden sm:block text-sm text-gray-600">
            📍 3 Baden Street
          </div> */}
        </div>

        {/*   Center Section: Search Bar */}
        <div className="flex grow md:max-w-lg justify-center md:ml-5">
          {/* <div className="flex items-center bg-gray-100 rounded-lg p-5 md:px-4 md:py-3 w-full shadow-lg">
            <SearchFiltersContextProvider>
              <SearchBox />
            </SearchFiltersContextProvider>
          </div> */}
        </div>

        {/* Right Section: Cart + Auth Buttons */}
        <div className="flex items-center justify-end whitespace-nowrap border-2">
          {/* Cart icon with badge */}
          {/* <div className="relative">
            <button>🛒</button>
            <span className="absolute -top-1 -right-1 text-xs bg-green-500 text-white rounded-full px-1">
              0
            </span>
          </div> */}

          {/* Auth buttons */}
          {/* <button className="text-sm">Log in</button>
          <button className="text-sm font-semibold">Sign up</button> */}
        </div>
      </div>
    </header>
  );
}
