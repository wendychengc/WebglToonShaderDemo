let vertexShaderToon = `
        uniform vec3 color;
        uniform vec3 light;
        varying vec3 vColor;
        varying vec3 vPosition;
        varying vec2 vUv;
        varying vec3 viewLight;
        varying vec3 viewPosition;
        varying vec3 viewNormal;
        void main()
        {
            // 直接传递给fs
            vColor = color;
            vPosition = position;
            vUv = uv;
        
            // 转换成视图坐标系（摄像机位置即坐标原点）下的光源坐标/顶点坐标/法线坐标，传递给fs
            // viewLight = normalize( (modelViewMatrix * vec4(light, 1.0)).xyz );
            viewLight = normalize(vec4(light, 1.0).xyz);
            viewPosition = ( modelViewMatrix * vec4(position, 1.0)).xyz;
            viewNormal = normalize(normalMatrix * normal);
        
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        
        }
    `
let fragShaderToon = `
        varying vec3 vColor;
        varying vec3 vPosition;
        varying vec2 vUv;
        varying vec3 viewLight;
        varying vec3 viewPosition;
        varying vec3 viewNormal;
        uniform sampler2D _MainTex;
        uniform sampler2D _skinMap;
        uniform int hasSkinMap;
        uniform int isHighlight;
        uniform int isRimlight;
        uniform int isDimtoon;
        uniform mat4 modelMatrix;
        void main() {        
            // 计算基础色
            vec3 albedoColor = texture2D(_MainTex, vUv).rgb;
            // 计算卡通渲染下的阶梯阴影
            float diffuse = dot(viewLight, viewNormal);
            if (diffuse > 0.7) {
                diffuse = 1.0;
            }
            else if (diffuse > 0.3) {
                diffuse = 0.7;
            }
            else {
                diffuse = 0.5;
            }
            
        
            // 计算高光反射值（Phong模型）
            float shininessVal=1.0;
            vec3  specularColor = vec3(1.0, 1.0, 1.0);
            vec3 L = viewLight;
            vec3 R = reflect(-viewLight, viewNormal);   // 计算光源沿法线反射后的方向
            vec3 V = normalize(-viewPosition); // 视图坐标系下，坐标的负值即为视线方向
            float specAngle = max(dot(R, V), 0.0); // 两个方向的夹角（点积）即为高光系数，越接近平行，高光越强烈
            float specularFactor = pow(specAngle, shininessVal);
            // 卡通渲染阶梯化处理
            if (specularFactor > 0.8) {
                specularFactor = 0.5;
            }
            else {
                specularFactor = 0.0;
            }
            if(hasSkinMap == 1){
                float skinMask = texture2D(_skinMap, vUv).r;
                if(skinMask == 1.0){
                    specularFactor = 0.0;
                }
            }
        
            // 计算rim lighting
            vec3 rimColor = vec3(1.0, 0.0, 0.0);
            float rimFactor = 0.5;
            float rimWidth = 1.0;
            float rimAngle = max( dot(viewNormal, V), 0.0); // 简单计算，取视线方向和法线方向的夹角（点积），越接近垂直，越靠近模型边缘
            float rimndotv =  max(0.0, rimWidth - rimAngle);
            // 卡通渲染阶梯化处理
            // if (rimndotv > 0.4) {
            //     rimndotv = 1.0;
            // }
            // else {
            //     rimndotv = 0.0;
            // }
        
            if(isDimtoon == 0){
                diffuse = 1.0;
            }
            vec3 finalColor = albedoColor * diffuse;
            if(isHighlight == 1){
                finalColor += specularColor * specularFactor;
            }
            if(isRimlight == 1){
                finalColor += rimColor * rimndotv * rimFactor;
            }
            gl_FragColor = vec4( finalColor, 1.0);
        }
    `
let vertexShaderOutline = `
    uniform float offset;
    void main() {
      vec4 pos = modelViewMatrix * vec4( position + normal * offset, 1.0 );
      gl_Position = projectionMatrix * pos;
    }`
let fragShaderOutline = `
  uniform vec3 color;
    void main(){
      gl_FragColor = vec4( color, 1.0 );
    }`
let vertexShaderMask = `
    uniform float offset;
    void main() {
      gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
    }`
let fragShaderMask = `
    void main(){
      gl_FragColor = vec4( 1.0, 1.0, 1.0, 1.0 );
    }`
let vertexShaderEdge = `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
    }`;

let fragShaderEdge = `
    uniform sampler2D maskTexture;
    uniform vec2 texSize;
    uniform vec3 color;
    uniform float thickness;

    varying vec2 vUv;

    void main() {
        vec2 invSize = thickness / texSize;
        vec4 uvOffset = vec4(1.0, 0.0, 0.0, 1.0) * vec4(invSize, invSize);

        vec4 c1 = texture2D( maskTexture, vUv + uvOffset.xy);
        vec4 c2 = texture2D( maskTexture, vUv - uvOffset.xy);
        vec4 c3 = texture2D( maskTexture, vUv + uvOffset.yw);
        vec4 c4 = texture2D( maskTexture, vUv - uvOffset.yw);
        
        float diff1 = (c1.r - c2.r)*0.5;
        float diff2 = (c3.r - c4.r)*0.5;
        
        float d = length(vec2(diff1, diff2));
        gl_FragColor = d > 0.0 ? vec4(color, 1.0) : vec4(0.627, 0.627, 0.627, 0.0);
    }`;
export { vertexShaderToon, fragShaderToon, vertexShaderOutline, fragShaderOutline, vertexShaderMask, fragShaderMask, vertexShaderEdge, fragShaderEdge };