import autoprefixer from "autoprefixer";
import prefixSelector from "postcss-prefix-selector";

export default {
  plugins: [
    prefixSelector({
      prefix: ".journey",
      includeFiles: [/materialize[^/\\]*\.css$/],
      transform(prefix, selector, prefixed) {
        if (/^(html|body|:root)(\b|$|[\s.:])/.test(selector)) {
          return selector.replace(/^(html|body|:root)/, prefix);
        }
        return prefixed;
      },
    }),
    autoprefixer(),
  ],
};
