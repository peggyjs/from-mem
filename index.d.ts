export = fromMem;
/**
 * Import or require the given code from memory.  Knows about the different
 * Peggy output formats.  Returns the exports of the module.
 *
 * @param {string} code Code to import
 * @param {FromMemOptions} options Options.  Most important is filename.
 * @returns {Promise<unknown>} The evaluated code.
 */
declare function fromMem(code: string, options: FromMemOptions): Promise<unknown>;
declare namespace fromMem {
    export { guessModuleType, FromMemOptions, ModuleType };
}
/**
 * Options for how to process code.
 */
type FromMemOptions = {
    /**
     * What format does the code have?  "guess" means to read the closest
     * package.json file looking for the "type" key.
     */
    format?: "amd" | "bare" | "commonjs" | "es" | "globals" | "guess" | "umd" | undefined;
    /**
     * What is the fully-qualified synthetic
     * filename for the code?  Most important is the directory, which is used to
     * find modules that the code import's or require's.
     */
    filename: string;
    /**
     * Variables to make availble in the global
     * scope while code is being evaluated.
     */
    context?: object | undefined;
    /**
     * Include the typical global
     * properties that node gives to all modules.  (e.g. Buffer, process).
     */
    includeGlobals?: boolean | undefined;
    /**
     * For type "globals", what name is
     * exported from the module?
     */
    globalExport?: string | undefined;
};
/**
 * Figure out the module type for the given file.  If no package.json is
 * found, default to "commonjs".
 *
 * @param {string} filename Fully-qualified filename to start from.
 * @returns {Promise<ModuleType>}
 * @throws On invalid package.json
 */
declare function guessModuleType(filename: string): Promise<ModuleType>;
declare namespace guessModuleType {
    function clearCache(): void;
}
type ModuleType = "commonjs" | "es";
