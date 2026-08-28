// pg ships an optional native binding (pg-native) that we never use. esbuild
// bundling for Neon Functions tries to resolve it, so this stub satisfies the
// import. The API code never requires it at runtime.
export default {};
