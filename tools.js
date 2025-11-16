export async function getShader(path = String) {
    try {
        if (path.startsWith("./")) {path.slice(2)}
        const Res = await fetch(path)
        const Shader = await Res.text();
        return Shader;
    } catch (e) {
        console.error(e)
        return null;
    }
}