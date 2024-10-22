import zipPack from "vite-plugin-zip-pack";

export default {
  build: {
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
  plugins: [
    zipPack({
      outDir: "dist-release",
      outFileName: "xdcterm.xdc",
    }),
  ],
};
