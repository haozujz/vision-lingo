// jshint esversion:8

let net = null;

if (!Math.trunc) {Math.trunc = function (v) {return v < 0 ? Math.ceil(v) : Math.floor(v)}}

function setup() { 
Vue.component('camera-mode',{
  props: {
    mode: {
      type: Number,
      required: true
    },
    activeLang: {
      type: String,
      required: true      
    }
  },
  template:`
    <div class="camera" v-show="mode===0">
      <video ref="video" id="video" autoplay></video>
      <canvas ref="canvas" id="camera-stream" v-show="!isPhotoTaken"></canvas>
      <img ref="photo" id="photo" v-show="isPhotoTaken"></img>
      <div :class="['camera-label', {lang:activeLang!=='none'}]">
        <p>{{pred}}</p>
      </div>
      <div :class="['camera-prob', {lang:activeLang!=='none'}]">
        <p>{{prob}}</p>
      </div>
      <button class="camera-label-trans" v-show="activeLang!=='none'" @click="toggleActiveLangViewC">
        <p>{{trans}}</p>
        <div v-if="isTranslating" class="camera-load-trans">
            <div class="one"></div>
            <div class="two"></div>
            <div class="three"></div>
        </div>
      </button>
      <div class="container-component-btn">
        <button class="btn-camera-main" v-show="!isPhotoTaken" @click="takePhoto()">
          <img class="feather-camera-main" src="https://cdn.glitch.global/caf65686-e31c-48de-953b-126c6d3b432c/pause.svg?v=1659845850115"/>
        </button>
        <a ref="link" v-show="isPhotoTaken">
        <button class="btn-camera-aux" v-show="isPhotoTaken" @click="downloadPhoto()">
          <span style="font-size: 1.7vh;">Download</span>
          <img class="feather-camera-aux" src="https://cdn.glitch.global/caf65686-e31c-48de-953b-126c6d3b432c/download.svg?v=1659845851664"/>
        </button>
        </a>
        <button class="btn-camera-main" v-show="isPhotoTaken" @click="cancelPhoto()">
          <img class="feather-camera-main" style="left: 0.35vh;" src="https://cdn.glitch.global/caf65686-e31c-48de-953b-126c6d3b432c/play.svg?v=1659845850159"/>
        </button>
        <button class="btn-camera-aux" v-show="isPhotoTaken" @click="uploadPhoto()">
          <span v-show="!isPhotoUploaded" style="font-size: 1.7vh;">Upload</span>
          <span v-show="isPhotoUploaded" style="font-size: 1.7vh;">Uploaded</span>
          <img class="feather-camera-aux" v-show="!isPhotoUploaded" src="https://cdn.glitch.global/caf65686-e31c-48de-953b-126c6d3b432c/upload.svg?v=1659845850628"/>
          <img class="feather-camera-aux" v-show="isPhotoUploaded" src="https://cdn.glitch.global/caf65686-e31c-48de-953b-126c6d3b432c/tick.svg?v=1659845850460"/>
        </button>
      </div>
      <img :class="['feather-camera-upload', { isUploading: isUploading }]" src="https://cdn.glitch.global/caf65686-e31c-48de-953b-126c6d3b432c/tick.svg?v=1659845850460"/>
    </div>
`,
  data() {
    return{
      isWarmingUpOrIsPredicting: false,
      isTurningOn: false,
      isPhotoTaken: false,
      isPhotoUploaded: false,
      isUploading: false,
      pred: null,
      prob: null,
      trans: null,
      isTranslating: false
    }
  },
  methods: {     
    createCameraElement() {
      if (this.isTurningOn === true) {return}
      this.isTurningOn = true
      if (this.$refs.video.srcObject === null) {
        const constraints = (window.constraints = {
        audio: false,
        video: {facingMode: 'environment'}
      });
      navigator.mediaDevices
        .getUserMedia(constraints)
        .then(stream => {this.$refs.video.srcObject = stream;this.isTurningOn = false})
        .catch(error => {alert('Error. No camera detected.');this.isTurningOn = false})
        .finally(this.toggleCameraStream);
      } 
    },    
    toggleCameraStream() {
      if (this.mode!==0 && this.$refs.video.srcObject!==null) {       
        let tracks = this.$refs.video.srcObject.getTracks();
        tracks.forEach(track => {
        track.stop()})       
        this.$refs.video.srcObject = null
        const canvas = this.$refs.canvas
        const ctx = canvas.getContext('2d');        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      } else if (this.mode!==0) {     
        const canvas = this.$refs.canvas
        const ctx = canvas.getContext('2d');        
        ctx.clearRect(0, 0, canvas.width, canvas.height);                
      } else if (this.mode===0) {
        this.videoToCanvas();
      }
    },
    async takePhoto() {
      if (this.$refs.video.videoWidth!==0) {
        this.isPhotoTaken = true;
       
        const canvas = this.$refs.canvas
        const ctx = canvas.getContext('2d');
        const size = canvas.width;          
        await ctx.drawImage(this.$refs.video, 0, 0, size, size, 0, 0, size, size);  // w/2 - size/2     
        
        //objectURL. Seems the conversion to objectURL is slower than to dataURL
        //await canvas.toBlob((blob)=>{
        //  this.$refs.photo.src = URL.createObjectURL(blob)
        //});
        
        //dataURL
        let dataURL = await canvas.toDataURL();
        this.$refs.photo.src = await dataURL;
        
        //predict
        const result = await net.classify(this.$refs.canvas);      
        this.pred = this.formatCapitalize(result[0].className);
        this.prob = this.formatToPercentage(result[0].probability);
        
        if (localStorage.getItem(this.pred)) {this.viewTrans()} 
        else {this.trans = null; this.translate(this.pred)}                                               
      }
    },
    async translate(x) {
      if (this.isTranslating===true) {return}
      this.isTranslating = true
      
      let options = {
        method: 'POST',
        timeout: 60000,
        url: 'https://image-translator-api-proxy.glitch.me/micr',
        data: {
          endpt: '&from=en&to=ja',
          outputLang: ['ja', 'yue'],
          text: x
        }
      }; 
      
      let options2 = {
        method: 'POST',
        timeout: 60000,
        url: 'https://image-translator-api-proxy.glitch.me/gool',
        data: {
          outputLang: 'hiragana',
          text: x
        }
      }; 
      
      let options3 = {
        method: 'POST',
        timeout: 60000,
        url: 'https://image-translator-api-proxy.glitch.me/gool',
        data: {
          outputLang: 'katakana',
          text: x
        }
      }; 
      
      let ja, hira, kata, yue
      await axios.request(options) 
        .then(r => {
	        ja = r.data.result
          yue = r.data.result2}) 
        .catch(err => {ja = false});
                                      
      options2.data.sentence = ja
      options3.data.sentence = ja
      
      await axios.all([
        axios.request(options2),
        axios.request(options3)])
      .then(axios.spread((h, k) => {
        hira = h.data.result
        kata = k.data.result}))
      .catch(error => {ja = false});
      
      if (!ja) {this.isTranslating = false; this.trans = 'error'; return}      
      
      localStorage.setItem(x, ja+'_'+hira+'_'+kata+'_'+yue)
      this.viewTrans()
                
      this.isTranslating = false          
    },
    viewTrans() {
      if (!(localStorage.getItem(this.pred))) {return}
      
      let x = localStorage.getItem(this.pred)
      x = x.split('_')
      if (this.activeLang === 'kanji') {this.trans = x[0]}
      else if (this.activeLang === 'hira') {this.trans = x[1]}
      else if (this.activeLang === 'kata') {this.trans = x[2]}
      else if (this.activeLang === 'chinese') {this.trans = x[3]}       
    },
    uploadPhoto() {
      if (this.isPhotoUploaded == false) {
        let dataURL = this.$refs.photo.src;
        let blob = this.toBlob(dataURL);
        let objectURL = URL.createObjectURL(blob)
        
        this.isPhotoUploaded = true;
        
        let time = this.getTime();  
        
        let label = {
          id: null,
          time: time,
          pred: this.pred,
          prob: this.prob,
          image: objectURL
        }     
        this.$emit('new-pred', [label]);        
        
        this.isUploading = false;        
        setTimeout(()=>{this.isUploading = true}, 10);
      }
    },
    downloadPhoto() {          
      const canvas = this.$refs.canvas;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(this.$refs.photo, 0, 0)
      saveCanvas(this.$refs.canvas, 'sample', 'png');      
    },
    cancelPhoto() {
      this.isPhotoTaken = false;  
      this.isPhotoUploaded = false;
      this.predictCanvas();
    },   
    getTime() {      
      function format(number) {return (number < 10 ? '0' : '') + number}
      return format(hour())+':'+format(minute())+':'+format(second());     
    },
    formatCapitalize(word) {
      return word[0].toUpperCase() + word.substring(1).toLowerCase();
    },
    formatToPercentage(number) {
      return Math.trunc(number*100)+'%'  
    },
    toBlob(dataURL) {  
      var arr = dataURL.split(','), mime = arr[0].match(/:(.*?);/)[1],
        bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n);
      while(n--){
        u8arr[n] = bstr.charCodeAt(n);
      }
    return new Blob([u8arr], {type:mime}); 
    },
    videoToCanvas() {
      const canvas = this.$refs.canvas
      const ctx = canvas.getContext("2d");
      const video = this.$refs.video
      const startPredictCanvas = this.startPredictCanvas;
      
      function onPlay() {
        function step() {
          ctx.drawImage(video, 0, 0)
          if (video.videoWidth !== 0) {requestAnimationFrame(step)} 
          else {video.removeEventListener('play',onPlay);}
        }
          requestAnimationFrame(step);      
      }
      
      function onLoadedMetaData() {
        const w = video.videoWidth;
        const h = video.videoHeight;
        let size     
        if (w <= h) {
          canvas.width = w;
          canvas.height = w;
          size = w
        } else {
          canvas.width = h;
          canvas.height = h;
          size = h
        }
        video.addEventListener('play',onPlay);
        video.removeEventListener('loadedmetadata', onLoadedMetaData);        
        startPredictCanvas();
      }
      
      if (video.videoWidth === 0 && this.mode===0) {              
        video.addEventListener('loadedmetadata', onLoadedMetaData);               
      }     
    },
    startPredictCanvas() {
      if (!this.isWarmingUpOrIsPredicting) {       
        this.isWarmingUpOrIsPredicting = true;
        setTimeout(this.predictCanvas, 30);
      }
    },
    async predictCanvas() {
      if (!this.isPhotoTaken && this.mode===0) {       
        const result = await net.classify(this.$refs.canvas);
        this.pred = this.formatCapitalize(result[0].className);
        this.prob = this.formatToPercentage(result[0].probability);
        
        if (localStorage.getItem(this.pred)) {this.viewTrans()} 
        else {this.trans = null}
        
        this.predictCanvas();
      } else if (!this.isPhotoTaken) {
        this.pred = null;
        this.prob = null;
        this.trans = null;
        this.isWarmingUpOrIsPredicting = false;
      } else {
        this.isWarmingUpOrIsPredicting = false;
      }
    },
    toggleActiveLangViewC() {
      if (localStorage.getItem(this.pred)) {this.$emit('toggle-active-lang-view-c')}
      else {this.translate(this.pred)}
    },
  },
  watch: {
    mode: function() {
      if(this.mode===0) {
        this.isUploading = false;
        this.createCameraElement();
      } else {
        this.toggleCameraStream();
      }
    },
    activeLang: function() {
      this.viewTrans();
    }
  }
}) 
  
Vue.component('import-mode',{
  props: {
    mode: {
      type: Number,
      required: true
    }
  },
  template:`
    <div class="dropbox" v-show="mode===1">
      <input ref="drop" type="file" @click="checkStep()" @change="onFileChange($event)" accept="image/*" :class="['drop-field', { isLoading: isLoading }]" multiple/>
      <div id="preview">
          <div class="empty-box"></div>
          <img v-show="image" :src="image"/>
          <canvas ref="interim" class="interim"></canvas>
      </div>
      <div class="container-text">
        <span ref="loadbar" class="import-loadbar"></span>
        <p>{{label}}</p>
        <div v-if="isLoading" class="load">
          <div class="one"></div>
          <div class="two"></div>
          <div class="three"></div>
        </div>
      </div>
      <div class="loading-disabler" v-show="isLoading"></div>
      <div class="container-component-btn">      
        <div id="switch">
          <input ref="checkbox" type="checkbox" class="checkbox">
          <div class="knob"><span></span></div>
          <div class="knob-bg"></div>
        </div>      
      </div>
    </div>
`,
  data() { 
    return {
      image: null,
      isFullscreen: false,
      isForcedOutOfFullscreen: false,
      label: null,
      isLoading: false,
      labels: [],
      filesLength: null,
      isResizeMode: false,
      interimLabels: [] 
    }  
  },
  methods: {
    async onFileChange(e) {
      this.isLoading = true
      this.label = null
      this.labels = []  //redundant
      this.interimLabels = [] //redundant
      let files = await e.target.files || e.dataTransfer.files;
      this.filesLength = files.length;
      for (let i = files.length-1; i >= 0; i--) {
        x = URL.createObjectURL(files[i])
        await this.handleObjectURL(x)
      }
    },
    handleObjectURL(x) {
      let canvas = this.$refs.interim;
      let ctx = canvas.getContext('2d');      
      let img = new Image();
      
      img.src = x;
      
      img.onload = () => {
        canvas.width = 1000;
        canvas.height = 1000;        
        if (this.isResizeMode) {
          ctx.drawImage(img,0,0,img.width,img.height,0,0,1000,1000);
        } else {          
          const w = img.width;
          const h = img.height;
          let size       
          if (w <= h) {
            size = w
          } else {
            size = h
          }
          ctx.drawImage(img,w/2-size/2,h/2-size/2,size,size,0,0,1000,1000);
        }       
        canvas.toBlob((blob)=>{
          let objectURL = URL.createObjectURL(blob)
          this.handleInterim(img, objectURL)
        });     
        URL.revokeObjectURL(x)     
      };     
    },
    async handleInterim(img, objectURL) {
      let interimLabel = await [img, objectURL]
      await this.interimLabels.push(interimLabel)
      
      if (this.interimLabels.length !== this.filesLength) {return}
                                                                 
      for (let i = this.interimLabels.length-1; i >= 0; i--) {
        await this.handleImage(this.interimLabels[i][0], this.interimLabels[i][1])
      }
    },
    maintainFullscreen() {
      if (this.isFullscreen) {
        this.isFullscreen = false;
        this.isForcedOutOfFullscreen = false;
        let elem = document.documentElement;
        if (elem.requestFullscreen) {
          elem.requestFullscreen();
        } else if (elem.webkitRequestFullscreen) { //Safari
          elem.webkitRequestFullscreen();
        } else if (elem.msRequestFullscreen) { //IE11
          elem.msRequestFullscreen();
        } else if (elem.mozRequestFullScreen) { //Mozilla
          elem.mozRequestFullScreen();
        }    
      }      
    },
    checkStep() {
      if (!this.isForcedOutOfFullscreen) {
        if (!document.fullscreenElement &&
    !document.webkitFullscreenElement && !document.msFullscreenElement && !document.mozFullScreenElement) {this.isFullscreen=false;}else{this.isFullscreen=true; this.isForcedOutOfFullscreen=true;} 
      }
      this.isResizeMode = this.$refs.checkbox.checked;
    },
    async handleImage(sample, objectURL) {      
      let time = await this.getTime();      
      let y
      let prob
      
      try {
        let result = await net.classify(sample);
        
        if (!result[0].className || !result[0].probability) {
          y = '_'
          prob = '_'                
        } else {
          y = await this.formatCapitalize(result[0].className);
          prob = await this.formatToPercentage(result[0].probability);        
        }
      } catch(e) {
        print(e)
        y = '_'
        prob = '_'
      }
          
      let label = await {
        id: null,
        time: time,
        pred: y,
        prob: prob,
        image: objectURL
      }
      await this.labels.push(label);
      
      let bar = str(100 - (this.filesLength - this.labels.length)*100/this.filesLength)
      this.$refs.loadbar.setAttribute("style", "width: "+bar+"%;")
      
      if (this.labels.length === this.filesLength) {
        this.$refs.loadbar.setAttribute("style", "width: 0;")
        this.isLoading = false;
        this.image = objectURL;
        this.label = y;
        this.$emit('new-pred', this.labels);
        this.$refs.drop.value = null;
        this.labels = [];
        this.interimLabels = [];  
      }
    }, 
    getTime() {      
      function format(number) {return (number < 10 ? '0' : '') + number}
      return format(hour())+':'+format(minute())+':'+format(second());     
    },
    formatCapitalize(word) {
      return word[0].toUpperCase() + word.substring(1).toLowerCase();
    },
    formatToPercentage(number) {
      return Math.trunc(number*100)+'%'  
    },
    toggleResizeOrCrop() {
      this.isCropMode = !this.isCropMode;
    }
  },
  watch: {
    mode: function() {
      if(this.mode!==1 && this.isFullscreen) {
        this.maintainFullscreen();
      }
    }
  }
}) 
  
  
Vue.component('flash-card',{
  props: {
    card: {
      type: Object,
      required: true
    },
    deal: {
      type: Boolean,
      required: true
    },
    activeLang: {
      type: String,
      required: true          
    }
  },
  template:`     
    <div ref="interactElement" class="card"
      :style="{ transform: transformString }" 
      :class="{isDragging: isDragging, isAnimating: isAnimating}"> 
      <div id="preview">
        <img class="card-image" :src="card.image"/>
      </div>
      <div :class="['container-card-text', {lang: activeLang!=='none'}]" ref="predText">
        <p>{{card.pred}}</p>
      </div>
      <div class="container-subtext">
        <p :class="['card-subtext-left', {lang: activeLang!=='none'}]">{{card.id}}. {{time}}</p>
        <p :class="['card-subtext-right', {lang: activeLang!=='none'}]">{{card.prob}}</p>
      </div>
      <button class="card-label-trans" v-show="activeLang!=='none'" ref="transText">
        <p style="pointer-events: none;">{{trans}}</p>
        <div v-if="isTranslating" class="card-load-trans" style="pointer-events: none;">
            <div class="one"></div>
            <div class="two"></div>
            <div class="three"></div>
        </div>
      </button>
    </div>
`,
  data() {
    return{
      isDragging: false,
      isAnimating: false,
      dragThreshold: 200,
      interactPosition: {
        x: 0,
        y: 0
      },
      trans: null,
      isTranslating: false
    }
  },
  methods: {
    interactSetPosition(coordinates) { 
      const {x=0, y=0} = coordinates;
      this.interactPosition = {x,y};
    },
    resetCardPosition() {
      this.interactSetPosition({x:0, y:0});
    },
    changeCardOrder() {
      this.$emit('change-card-order', this.card.id);
    },
    deleteCard() {
      if(!this.deal) {      
        URL.revokeObjectURL(this.card.image);
        this.$emit('delete-card', this.card.id);
      }
    },
    toggleActiveLangView() {
      if (localStorage.getItem(this.card.pred)) {this.$emit('toggle-active-lang-view1')}
      else {this.translate(this.card.pred)}
    },
    async translate(x) {
      if (this.isTranslating === true) {return}
      this.isTranslating = true
      
      let options = {
        method: 'POST',
        timeout: 60000,
        url: 'https://image-translator-api-proxy.glitch.me/micr',
        data: {
          endpt: '&from=en&to=ja',
          outputLang: ['ja', 'yue'],
          text: x
        }
      }; 
      
      let options2 = {
        method: 'POST',
        timeout: 60000,
        url: 'https://image-translator-api-proxy.glitch.me/gool',
        data: {
          outputLang: 'hiragana',
          text: x
        }
      };  
      
      let options3 = {
        method: 'POST',
        timeout: 60000,
        url: 'https://image-translator-api-proxy.glitch.me/gool',
        data: {
          outputLang: 'katakana',
          text: x
        }
      }; 
      
      let ja, hira, kata, yue
      await axios.request(options) 
        .then(r => {
	        ja = r.data.result
          yue = r.data.result2}) 
        .catch(err => {ja = false});
                                        
      options2.data.sentence = ja
      options3.data.sentence = ja                                        
      
      await axios.all([
        axios.request(options2),
        axios.request(options3)])
      .then(axios.spread((h, k) => {
        hira = h.data.result
        kata = k.data.result}))
      .catch(error => {ja = false});
      
      if (!ja) {return}      
      
      localStorage.setItem(x, ja+'_'+hira+'_'+kata+'_'+yue)
      this.viewTrans()
                
      this.isTranslating = false                
    },
    viewTrans() {
      //resize prediction text
      if (this.activeLang === 'none') {this.$refs.predText.setAttribute("style", "font-size: 3vh; top: 42vh;"); return}
      if (this.card.pred.length>45) {
        this.$refs.predText.setAttribute("style", "font-size: 1.7vh; top: 50.3vh; justify-content: inherit;")       
      }
      else if (this.card.pred.length>30) {
        this.$refs.predText.setAttribute("style", "font-size: 1.9vh; top: 50.25vh; justify-content: space-evenly;")
      }
      else {
        this.$refs.predText.setAttribute("style", "font-size: 2.1vh;top: 50.2vh; justify-content: space-evenly;")
      }
      
      //view translation text
      if (!(localStorage.getItem(this.card.pred))) {return}
      
      let x = localStorage.getItem(this.card.pred)
      x = x.split('_')
      if (this.activeLang === 'kanji') {this.trans = x[0]}
      else if (this.activeLang === 'hira') {this.trans = x[1]}
      else if (this.activeLang === 'kata') {this.trans = x[2]}
      else if (this.activeLang === 'chinese') {this.trans = x[3]}
      
      //resize translation text
      if (this.trans.length>60) {this.$refs.transText.setAttribute("style", "font-size: 1.6vh;")}
      else if (this.trans.length>45) {this.$refs.transText.setAttribute("style", "font-size: 1.8vh;")}                                                     
      else if (this.trans.length>30) {this.$refs.transText.setAttribute("style", "font-size: 2vh;")}
      else {this.$refs.transText.setAttribute("style", "font-size: 2.2vh;")}                                                    
    }
  },
  computed: {
    transformString() {
      if (this.isDragging) {
        const {x,y} = this.interactPosition;
        return `translate3D(${x}px, ${y}px, 0)`;
      }
    },
    time() {
      if (this.activeLang==='none') {
        return this.card.time
      }
    }
  },
  mounted() {
    this.viewTrans()
    
    const element = this.$refs.interactElement;
    interact(element).draggable({
      onstart: () => {
        this.isDragging = true;
        this.isAnimating = false;
      },
      onmove: event => {
        const x = this.interactPosition.x + event.dx;
        const y = this.interactPosition.y + event.dy;
        this.interactSetPosition({x,y});
      },
      onend: () => {
        const {x,y} = this.interactPosition;
        if (!this.deal) {
          this.isDragging = false;
          if (dist(0,0,x,y)>this.dragThreshold) {
            this.isAnimating = false;
            this.resetCardPosition();
            this.changeCardOrder();         
          }else {
            this.isAnimating = true;
            this.resetCardPosition();         
          }
        }
      },
      beforeDestroy() {
        interact(element).unset();
      },
    })
    .on('doubletap', event => {
      if (/^button$/i.test(event.target.nodeName)) {return null}      //+ 'pointer events none' on overlying elements     
      this.deleteCard();
      event.preventDefault();
    })
    
    const element2 = this.$refs.transText;
    interact(element2)
    .on('tap', event => {
      this.toggleActiveLangView();
    })
  },
  watch: {
    activeLang: function() {
      this.viewTrans();
    }
  }
})   
  
Vue.component('browse-mode',{
  props: {
    mode: {
      type: Number,
      required: true
    },
    topcards: {
      type: Array,
      required: true
    },
    renderlimited: {
      type: Boolean,
      required: true
    },
    activeLang: {
      type: String,
      required: true      
    }
  },
  template:`
    <div class="cards" v-show="mode===2" :key="key">
      <flash-card
        v-for="(card, i) in topcards"
        :key="card.id"
        :card="card" 
        :mode="mode"
        @change-card-order="changeCardOrder2"
        @delete-card="deleteCard2"
        :deal="deal"
        :active-lang="activeLang"
        @toggle-active-lang-view1="toggleActiveLangView2"
        ></flash-card> 
      <div class="container-component-btn">
        <button class="btn-browse-aux" v-show="!deal" @click="changeCardOrderBottomToTop">
          <img class="feather-browse-aux" src="https://cdn.glitch.global/caf65686-e31c-48de-953b-126c6d3b432c/chevron-left.svg?v=1659845851116"/>
        </button>
        <button class="btn-browse-main" @click="toggleDealMode">
          <img class="feather-browse-main" v-show="!deal" src="https://cdn.glitch.global/caf65686-e31c-48de-953b-126c6d3b432c/max.svg?v=1659845849866"/>
          <img class="feather-browse-main" v-show="deal" src="https://cdn.glitch.global/caf65686-e31c-48de-953b-126c6d3b432c/min.svg?v=1659845849941"/>
        </button>
        <button class="btn-browse-aux" v-show="!deal" @click="changeCardOrderTopToBottom">
          <img class="feather-browse-aux" src="https://cdn.glitch.global/caf65686-e31c-48de-953b-126c6d3b432c/chevron-right.svg?v=1659845851376"/>
        </button>
      </div>
      <img :class="['feather-browse-bin', { isDeleting: isDeleting }]" src="https://cdn.glitch.global/caf65686-e31c-48de-953b-126c6d3b432c/bin.svg?v=1659845829552"/>
      <div class="container-text" v-show="renderlimited">
        <img class="feather-browse-alert" src="https://cdn.glitch.global/caf65686-e31c-48de-953b-126c6d3b432c/alert.svg?v=1659845821743"/>
      </div>
      <div class="container-subtext" style="color:orange; top:46vh;" v-show="renderlimited">
        <p>Only 10 at a time!</p>
      </div>
    </div>
`,
  data() {
    return{
      key: 0,
      isDeleting: false,
      deal: false
    }
  },  
  methods: {
    changeCardOrder2(id) {
      this.$emit('change-card-order2', id);
    },
    changeCardOrderTopToBottom() {
      this.$emit('change-card-order-top-to-bottom');
    },
    changeCardOrderBottomToTop() {
      this.$emit('change-card-order-bottom-to-top');
    },
    deleteCard2(id) {     
      this.isDeleting = false;        
      setTimeout(()=>{this.isDeleting = true}, 10);     
      this.$emit('delete-card2', id)        
    },
    toggleDealMode() {
      this.deal = !this.deal;
      if (!this.deal) {
        this.isDeleting = false;
        this.key++;
      }
    },
    toggleActiveLangView2() {
      this.$emit('toggle-active-lang-view2')
    }
  },
  watch: {
    mode: function() {
      if(this.mode===2) {
        this.isDeleting = false;
      }
    }
  }
}) 
  

Vue.component('navi',{
  props: {
    mode: {
      type: Number,
      required: true
    }
  },
  template:`
    <div class="navbar">
      <button id="btn-fullscreen" @click="toggleFullscreenN()">
        <img id="feather" src="https://cdn.glitch.global/caf65686-e31c-48de-953b-126c6d3b432c/plus-circle.svg?v=1659845850312"/>
      </button>
      <button id="btn-help" @click="toggleHelpScreen">
        <img id="feather" src="https://cdn.glitch.global/caf65686-e31c-48de-953b-126c6d3b432c/help-circle.svg?v=1659845851853"/>
      </button>
      <button
        v-for="(m, i) in ['Camera','Import','Browse']"
        :key="m"
        :class="['btn', { active: i === mode }]"
        @click="changeMode(i)">
        <span>{{m}}</span>
        <img v-if="i==0 & mode==0" class="feather" src="https://cdn.glitch.global/caf65686-e31c-48de-953b-126c6d3b432c/camera-dblue.svg?v=1659845839940"/>
        <img v-else-if="i==0" class="feather" src="https://cdn.glitch.global/caf65686-e31c-48de-953b-126c6d3b432c/camera.svg?v=1659845839940"/>
        <img v-if="i==1 & mode==1" class="feather" src="https://cdn.glitch.global/caf65686-e31c-48de-953b-126c6d3b432c/image-dblue.svg?v=1659845852341"/>
        <img v-else-if="i==1" class="feather" src="https://cdn.glitch.global/caf65686-e31c-48de-953b-126c6d3b432c/image.svg?v=1659845852104"/>
        <img v-if="i==2 & mode==2" class="feather" src="https://cdn.glitch.global/caf65686-e31c-48de-953b-126c6d3b432c/layers-dblue.svg?v=1659845849866"/>
        <img v-else-if="i==2" class="feather" src="https://cdn.glitch.global/caf65686-e31c-48de-953b-126c6d3b432c/layers.svg?v=1659845852580"/>
      </button>   
    </div>
`,
  data() {
    return {
    }  
  },
  methods: {
    toggleFullscreenN() {
      this.$emit('toggle-fullscreen')
    },
    changeMode(x) {
      this.$emit('change-mode', x)
    },
    toggleHelpScreen() {
      this.$emit('toggle-overlay')        
    }
  }
})  

  
Vue.component('translation-card',{
  props: {
    translation: {
      type: Array,
      required: true
    }
  },
  template:`     
<div ref="interactCard" class="form-output"><div class="form-output-top">{{translation[0]}}</div>{{translation[1]}}<div class="divider" v-if="translation[2] !== undefined"></div>{{translation[2]}}<div class="divider" v-if="translation[3] !== undefined"></div>{{translation[3]}}</div>
`,
  data() {
    return{      
    }
  },
  methods: {
    delete() {    
      this.$emit('delete');
    }
  },
  mounted() {  
    const element = this.$refs.interactCard;
    interact(element).on('doubletap', event => {
      this.delete();
      event.preventDefault();
    })
  }
})    
  
Vue.component('overlay',{
  props: {
    overlayhelp: {
      type: Boolean,
      required: true
    },
    overlayload: {
      type: Boolean,
      required: true
    },
    isloadingmodel: {
      type: Boolean,
      required: true
    },
    isKanjiOn: {
      type: Boolean,
      required: true
    },
    isHiraOn: {
      type: Boolean,
      required: true
    },
    isKataOn: {
      type: Boolean,
      required: true
    },
    isChineseOn: {
      type: Boolean,
      required: true
    }
  },
  template:`
    <div class="overlay">
      <div class="help-screen" v-show="overlayhelp">

        <div class="help-screen-splitL">
          <h1>
          <br>Camera<br><br><br><br><br>
          Import<br><br><br><br><br>
          Browse</h1>
        </div>
        <div class="help-screen-splitR">
          <br>Pause the video to take a photo.
          <br>Click 'Upload' to upload the photo to 'Browse' mode.
          <br>Click 'Download' to download the photo to device. You may also right-click to download the photo.
          <br><br><br><br><br>Click or drag to upload images to 'Browse' mode.
          <br>Images are either resized or cropped into a square.
          <br>(If using 'Import' mode forces you out of fullscreen, leaving the mode will recover it.)
          <br><br><br><br><br>Navigate through uploaded images by swipe gestures and delete by double-tapping.
          <br> Consider using landscape mode on mobile devices.
        </div>
        <div class="help-screen-bottom">
          <button
            :class="['btn-cover-help-screen', { active:isTranslatorOn, inactive:!isTranslatorOn }]" 
            @click="moveTranslatorButton">Translator</button>
          <div :class="['help-screen-bottom-mini', { active:isTranslatorOn, inactive:!isTranslatorOn }]"></div>
          <div class="help-screen-bottom-mini-ui">
            <button
              :class="['btn-lang', { active:isKanjiOn, inactive:!isKanjiOn }]"
              @click="toggleKanji">日本語</button>
            <button
              :class="['btn-lang', { active:isHiraOn, inactive:!isHiraOn }]"
              style="font-size: 1.93vh"
              @click="toggleHira">ひらがな</button>
            <button
              :class="['btn-lang', { active:isKataOn, inactive:!isKataOn }]"
              style="font-size: 1.93vh"
              @click="toggleKata">カタカナ</button>
            <button
              :class="['btn-lang', { active:isChineseOn, inactive:!isChineseOn }]"
              style="font-size: 2.1vh"
              @click="toggleChinese">粵語</button>
          </div>
        </div>
        <div class="help-screen-bottom">
          <button 
            :class="['btn-cover-help-screen', { active:isAdvancedOn, inactive:!isAdvancedOn }]"      
            @click="moveAdvancedButton">Advanced</button>
          <div :class="['help-screen-bottom-mini', { active:isAdvancedOn, inactive:!isAdvancedOn }]">
          </div>
          <div class="help-screen-bottom-mini-ui">
            <button
              :class="['btn-lang', { active:isToolsOn, inactive:!isToolsOn }]"
              @click="toggleTools">Tools</button>
            <button
              :class="['btn-lang', { active:isCreditsOn, inactive:!isCreditsOn }]"
              @click="toggleCredits">Credits</button>
          </div>
        </div>
          <div class="help-screen-small" v-show="isToolsOn">

            <div class="help-screen-tools-container">
              <div :class="['help-screen-tools-container-dropdown', { active:isLeftLangOpen }]">
                <button ref="dropdownL" class="dropdown" @click="toggleLang('l')">{{leftLang}}</button>
                <button class="dropdown-content" @mousedown="toggleLang('1')">English</button>
                <button class="dropdown-content" @mousedown="toggleLang('2')">日本語</button>
                <button class="dropdown-content" @mousedown="toggleLang('3')">ひらがな</button>
                <button class="dropdown-content" @mousedown="toggleLang('4')">カタカナ</button>
                <button class="dropdown-content" @mousedown="toggleLang('5')">粵語</button>
              </div>            
              <button :class="['btn-switcher', { rotate:btnAnimate==='rotate', wobble:btnAnimate==='wobble' }]" @click="toggleLang('s')">
                <img class="feather-switcher" src="https://cdn.glitch.global/caf65686-e31c-48de-953b-126c6d3b432c/chevron-right.svg?v=1659845851376"/>
              </button>      
              <div :class="['help-screen-tools-container-dropdown', { active2:isRightLangOpen }]">
                <button ref="dropdownR" class="dropdown" @click="toggleLang('r')">{{rightLang}}</button>
                <button class="dropdown-content" @mousedown="toggleLang('6')">English</button>
                <button class="dropdown-content" @mousedown="toggleLang('7')">日本語</button>
                <button class="dropdown-content" @mousedown="toggleLang('7a')">日本語+ひ</button>
                <button class="dropdown-content" @mousedown="toggleLang('7b')">日本語+カ</button>
                <button class="dropdown-content" @mousedown="toggleLang('7c')"
                        style="font-size: 17px">日本語+ひカ</button>
                <button class="dropdown-content" @mousedown="toggleLang('8')">ひらがな</button>
                <button class="dropdown-content" @mousedown="toggleLang('9')">カタカナ</button>
                <button class="dropdown-content" @mousedown="toggleLang('8a')">ひ+カ</button>
                <button class="dropdown-content" @mousedown="toggleLang('10')">粵語</button>
              </div>        
            </div>                   
            <form class="submitter" autocomplete="off" @submit.prevent="submit">
            <input type="text" maxlength = "1000" ref="form" class="form" v-model="inputForm" placeholder="Try and see!" @change="checkInput"><ul :class="['max-warning', {active:isAtMaxInput}]">1000 character limit!</ul>
            <button ref="btn" class="btn-submit" @click=""><img class="feather-submit" src="https://cdn.glitch.global/caf65686-e31c-48de-953b-126c6d3b432c/chevron-right.svg?v=1659845851376"/></button>
            </input>
            
            </form>
            <img :class="['feather-trans-bin', { isDeleting: isDeleting }]" src="https://cdn.glitch.global/caf65686-e31c-48de-953b-126c6d3b432c/bin.svg?v=1659845829552"/>
            <div ref="container" class="help-screen-tools-container-tiles">
              
              <translation-card
                v-for="(translation, i) in translations"
                :key="i"
                :index="i"
                :translation="translation" 
                @delete="deleteTrans(i)"></translation-card>
            </div>
            <div ref="container" class="help-screen-tools-container-counter" style="color: var(--pearl);">{{warning}}</div>        
            <div v-if="isTranslating" class="load-trans">
            <div class="one"></div>
            <div class="two"></div>
            <div class="three"></div>
            </div>
          </div>
          <div class="help-screen-small-credits" v-show="isCreditsOn">
            <br><br><br>
            <div class="help-screen-credits">
              <div class="help-screen-credits-splitL">
                <img class="credits-icon" src="https://cdn.glitch.global/caf65686-e31c-48de-953b-126c6d3b432c/duck.jpg?v=1659845851339"/>
                <div class="credits-icon-shadow"></div>
              </div>
              <div class="help-screen-credits-splitR">Joseph Zhu<div class="divider-credits"></div>haozu.jz@gmail.com</div>
            </div>
            <div class="help-screen-credits">
              <div class="help-screen-credits-splitL">
                <img class="credits-icon" src="https://cdn.glitch.global/caf65686-e31c-48de-953b-126c6d3b432c/labs.png?v=1659845850179"/></div>
                <div class="credits-icon-shadow"></div>
              <div class="help-screen-credits-splitR">Gooラボ - Hiragana conversion<div class="divider-credits"></div>https://labs.goo.ne.jp</div>
            </div>
            <div class="help-screen-credits">
              <div class="help-screen-credits-splitL">
                <img class="credits-icon" src="https://cdn.glitch.global/caf65686-e31c-48de-953b-126c6d3b432c/microsoft.png?v=1659845849866"/></div>
                <div class="credits-icon-shadow"></div>
              <div class="help-screen-credits-splitR">Microsoft Azure - Text translation<div class="divider-credits"></div>https://www.microsoft.com</div>
            </div>            
            <div class="help-screen-bottom" style="top: 2vh">
              <button
                :class="['btn-cover-help-screen', { active:isTroubleshootOn, inactive:!isTroubleshootOn }]"
                style="font-size: 1.99vh"
                @click="moveTroubleshootButton">Troubleshoot</button>
              <div :class="['help-screen-bottom-mini', { active:isTroubleshootOn, inactive:!isTroubleshootOn }]"></div>  
              <div class="help-screen-bottom-mini-ui">
                <button
                  class="btn-lang"
                  style="color: darkmagenta; font-size: 1.5vh"
                  @click="clearLS">Clear minor data and refresh</button>         
                <button
                  :class="['btn-lang', { active:isMobileKeyboardAideOn }]"
                  style="color: black; font-size: 1.5vh"
                  @click="toggleMBA">Toggle virtual keyboard aide</button>
              </div>          
            </div>
          </div>
      </div>
      <div class="loading-screen" v-if="overlayload">
        <h1 v-if="isloadingmodel">Loading...</h1>
        <h1 v-if="!isloadingmodel">Click the "?" to start<br>and "+" for fullscreen!</h1>
      </div>
      <div class="loading-disabler" v-if="isloadingmodel || isTranslating"></div>
    </div>
`,
  data() {
    return {
      isTranslatorOn: false,
      isAdvancedOn: false,
      isToolsOn: false,
      isCreditsOn: false,
      isTroubleshootOn: false,
      isMobileKeyboardAideOn: true,
      inputForm: '',
      leftLang: 'English',
      rightLang: '日本語+ひカ',
      isLeftLangOpen: false,
      isRightLangOpen: false,
      btnAnimate: null,
      warning: null,
      isAtMaxInput: false,
      isTranslating: false,
      translations: [],
      isDeleting: false
    }
  },
  methods: {
    moveTranslatorButton() {      
      this.isTranslatorOn = !this.isTranslatorOn
      this.toggler('isTranslatorOn')
    },
    moveAdvancedButton() {      
      this.isAdvancedOn = !this.isAdvancedOn
      this.toggler('isAdvancedOn')
    },
    moveTroubleshootButton() {      
      this.isTroubleshootOn = !this.isTroubleshootOn
    },
    clearLS() {
      localStorage.clear()
      location.reload();
    },
    toggleMBA() {     
      if (this.isMobileKeyboardAideOn === true) {
        localStorage.isMobileKeyboardAideOn = 'f'; 
        this.isMobileKeyboardAideOn = false;
      }
      else if (this.isMobileKeyboardAideOn === false) {
        localStorage.isMobileKeyboardAideOn = 't'; 
        this.isMobileKeyboardAideOn = true;
      } 
    },
    toggleKanji() {
      this.$emit('toggle-lang', 'kanji', true)
      this.toggler('isKanjiOn')
    },
    toggleHira() {
      this.$emit('toggle-lang', 'hira', true)
      this.toggler('isHiraOn')
    },
    toggleKata() {
      this.$emit('toggle-lang', 'kata', true)
      this.toggler('isKataOn')
    },
    toggleChinese() {
      this.$emit('toggle-lang', 'chinese', true)
      this.toggler('isChineseOn')
    },
    toggleTools() {
      this.$emit('toggle-overlay', 'alt')
      this.btnAnimate = null
      this.isDeleting = null
      this.isToolsOn = !this.isToolsOn      
      this.isCreditsOn = false
      this.toggler('isToolsOn')
      localStorage.isCreditsOn = 'f'
      if (!this.isCreditsOn) {this.isTroubleshootOn = false}
    },
    toggleCredits() {
      this.$emit('toggle-overlay', 'alt')
      this.btnAnimate = null
      this.isDeleting = null
      this.isCreditsOn = !this.isCreditsOn
      this.isToolsOn = false     
      this.toggler('isCreditsOn')
      localStorage.isToolsOn = 'f'
      if (!this.isCreditsOn) {this.isTroubleshootOn = false}
    },
    toggleToolsAlpha() {
      this.isToolsAlphaOn = !this.isToolsAlphaOn
      this.isToolsBetaOn = false     
      this.toggler('isToolsAlphaOn')
      localStorage.isToolsBetaOn = 'f'      
    },
    toggleToolsBeta() {
      this.isToolsBetaOn = !this.isToolsBetaOn
      this.isToolsAlphaOn = false     
      this.toggler('isToolsBetaOn')
      localStorage.isToolsAlphaOn = 'f'
    },
    toggler(str) {
      if (localStorage.getItem(str) === 't') {localStorage.setItem(str, 'f')}
      else {localStorage.setItem(str, 't')}
    },
    toggleLang(x) {
      let _this = this
      
      function onFocusout() {
        _this.isLeftLangOpen = false
        _this.isRightLangOpen = false
        _this.$refs.dropdownL.removeEventListener('focusout',onFocusout)
        _this.$refs.dropdownR.removeEventListener('focusout',onFocusout)
      }
      
      function flip() {
        let tmpR = _this.rightLang;
        if (tmpR==='日本語+ひ') {tmpR = '[日本語]+ひ'}
        else if (tmpR==='日本語+カ') {tmpR = '[日本語]+カ'}
        else if (tmpR==='日本語+ひカ') {tmpR = '[日本語]+ひカ'}
        let tmpL = _this.leftLang;
        if (tmpL==='[日本語]+ひ') {tmpL = '日本語+ひ'}
        else if (tmpL==='[日本語]+カ') {tmpL = '日本語+カ'}
        else if (tmpL==='[日本語]+ひカ') {tmpL = '日本語+ひカ'}
        _this.rightLang = tmpL; _this.leftLang = tmpR;        
      }
      
      if (x==='l') {
        this.isLeftLangOpen = !this.isLeftLangOpen;       
        this.$refs.dropdownL.addEventListener('focusout', onFocusout)}
      else if (x==='r') {
        this.isRightLangOpen = !this.isRightLangOpen;       
        this.$refs.dropdownR.addEventListener('focusout', onFocusout)}
      else if (x==='s') {
        this.btnAnimate = null;
        if (this.leftLang===this.rightLang||this.leftLang==='[日本語]+ひ'&&this.rightLang=== '日本語+ひ'||this.leftLang==='[日本語]+カ'&&this.rightLang=== '日本語+カ'||this.leftLang==='[日本語]+ひカ'&&this.rightLang=== '日本語+ひカ') {
          setTimeout(()=>{this.btnAnimate = 'wobble'}, 10);           
        } else {
          setTimeout(()=>{flip()}, 10)
          setTimeout(()=>{this.btnAnimate = 'rotate'}, 10); 
        } 
      }
      else if (x==='1') {this.leftLang = 'English'}
      else if (x==='2') {this.leftLang = '日本語'}
      else if (x==='3') {this.leftLang = 'ひらがな'}
      else if (x==='4') {this.leftLang = 'カタカナ'}
      else if (x==='5') {this.leftLang = '粵語'}
      else if (x==='6') {this.rightLang = 'English'}
      else if (x==='7') {this.rightLang = '日本語'}
      else if (x==='7a') {this.rightLang = '日本語+ひ'}
      else if (x==='7b') {this.rightLang = '日本語+カ'}
      else if (x==='7c') {this.rightLang = '日本語+ひカ'}
      else if (x==='8') {this.rightLang = 'ひらがな'}
      else if (x==='9') {this.rightLang = 'カタカナ'}
      else if (x==='8a') {this.rightLang = 'ひ+カ'}
      else if (x==='10') {this.rightLang = '粵語'}
    },
    checkInput() {
      if (this.inputForm.length>999) {
        this.isAtMaxInput = true
      } else {this.isAtMaxInput = false} 
    },
    async submit() {      
      this.$refs.form.blur()
      let l = this.leftLang
      let r = this.rightLang
      
      //ignore identical languages
      //ignore ambiguous 日本語/ひカ, and so reduce instances of using translator twice
      if (l===r||l==='[日本語]+ひ'&&r==='日本語'||l==='[日本語]+カ'&&r==='日本語'||l==='[日本語]+ひカ'&&r==='日本語'||this.inputForm.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,'') === '') {
        this.btnAnimate = null;
        setTimeout(()=>{this.btnAnimate = 'wobble'}, 10); 
        return;
      }     
      
      this.isTranslating = true
      
      let x
      let xP
      if (l === 'English') {x = 'en'}
      else if (l === '日本語') {x = 'ja'}
      else if (l === '[日本語]+ひ') {x = 'ja'}
      else if (l === '[日本語]+カ') {x = 'ja'}
      else if (l === '[日本語]+ひカ') {x = 'ja'}
      else if (l === 'ひらがな') {x = 'ja'; xP = 'hiragana';}      
      else if (l === 'カタカナ') {x = 'ja'; xP = 'katakana';}
      else if (l === 'ひ+カ') {x = 'ja'; xP = 'both';}
      else if (l === '粵語') {x = 'yue'}
          
      let y
      let yP
      let yKanji = false
      if (r === 'English') {y = 'en'}
      else if (r === '日本語') {y = 'ja'; yKanji = true}
      else if (r === '日本語+ひ') {y = 'ja'; yP = 'hiragana'; yKanji = true}
      else if (r === '日本語+カ') {y = 'ja'; yP = 'katakana'; yKanji = true}
      else if (r === '日本語+ひカ') {y = 'ja'; yP = 'both'; yKanji = true}
      else if (r === 'ひらがな') {y = 'ja'; yP = 'hiragana';}      
      else if (r === 'カタカナ') {y = 'ja'; yP = 'katakana';}
      else if (r === 'ひ+カ') {y = 'ja'; yP = 'both';}
      else if (r === '粵語') {y = 'yue'}
        
      let options = {
        method: 'POST',
        timeout: 60000,
        url: 'https://image-translator-api-proxy.glitch.me/micr',
        data: {
          endpt: '&from=' + x,
          outputLang: y,
          text: this.inputForm
        }
      }; 

      let options2 = {
        method: 'POST',
        timeout: 60000,
        url: 'https://image-translator-api-proxy.glitch.me/micr',
        data: {
          endpt: '&from=en',
          outputLang: 'ja',
          text: 'a'
        }
      }; 

      
      // if 2 sequential translations are needed to convert from phonetic>kanji       
      if (xP!==undefined && yKanji) {
        options.params.to = 'en'      
      }     
        
      let res
      let outputs = []
      let interimTrans = null
      // if require translation, ie. not just conversion from kanji/phonetic>phonetic or kanji+phonetic>kanji+phonetic or kanji>kanji+phonetic
      if (!(x==='ja' && xP===undefined && y==='ja' || xP!==undefined && yP!==undefined && !yKanji || x==='ja' && xP===undefined && yKanji)) {
        let usage
        
        await axios.request(options) 
          .then(response => {
            res = response.data.result;
            interimTrans = '!%#%#@%!->!%#%#@%!'+String(res).replace(/ /g, '!%#%#@%!');
            usage = response.data.usage;
            let p = Math.round(response.data.remaining*100/response.data.limit);
            let d = Math.round(response.data.reset/60/60/24)
            if (p < 16) {
              this.warning = 'Characters used: '+usage+' of '+(response.data.limit - response.data.remaining)+'/'+response.data.limit/1000+'k | Usage remaining: '+p+'% for '+d+' days';              
            }
            }) 
          .catch(error => {res = error}); 
        
        // if 2 sequential translations are needed to convert from phonetic>kanji      
        if (xP!==undefined && yKanji) {
          options2.data[0].text = res
          await axios.request(options2) 
            .then(response => {
            res = response.data.result;
            usage = parseInt(usage)+parseInt(response.data.usage)
            let p = Math.round(response.data.remaining*100/response.data.limit);
            let d = Math.round(response.data.reset/60/60/24);            
            if (p < 16) {
            this.warning = 'Characters used: '+usage+' of '+(response.data.limit - response.data.remaining)+'/'+response.data.limit+' | Usage remaining: '+p+'% for '+d+' days';              
            }            
            }) 
            .catch(error => {res = error});
        } else {interimTrans = null}  
      }
      
      //add result
      if (y==='en') {outputs.push(res)}
      else if (y==='yue') {String(res); outputs.push(String(res).replace(/ /g, '\n'))}
      else if (x!=='ja' && yKanji){outputs.push(String(res).replace(/ /g, '\n'))}
      else if (x==='ja' && xP===undefined && yKanji) {outputs.push(String(this.inputForm).replace(/ /g, '\n'))}
      else if (yKanji) {outputs.push(String(res).replace(/ /g, '\n'))}
      
      //phonetic conversion
      if (yP!==undefined && res!==undefined) {outputs = await this.convert(String(res).replace(/ /g, '、、'), yP, outputs)}
      else if (yP!==undefined && res===undefined) {outputs = await this.convert(String(this.inputForm).replace(/ /g, '、、'), yP, outputs)}
      
      //remove usage warning if phonetic conversion only
      if (x==='ja' && xP===undefined && y==='ja' || xP!==undefined && yP!==undefined && !yKanji) {this.warning = null}
      
      //add original input
      if (x==='en') {outputs.unshift(this.inputForm)}
      else if (interimTrans !== null) {outputs.unshift(String(this.inputForm + interimTrans).replace(/ /g, '\n').replace(/!%#%#@%!/g, ' '))}
      else if (x!=='en') {outputs.unshift(String(this.inputForm).replace(/ /g, '\n'))}
      //print(outputs)
      
      this.createTranslation(outputs)
    },
    async convert(sentence, p, outputs) {
      //hi/ka converter adds spaces after commas, and may add commas or spaces where there were none
      
      let options = {
        method: 'POST',
        timeout: 60000,
        url: 'https://image-translator-api-proxy.glitch.me/gool',
        data: {
          outputLang: 'hiragana',
          text: sentence
        }
      };  
      let options2 = {
        method: 'POST',
        timeout: 60000,
        url: 'https://image-translator-api-proxy.glitch.me/gool',
        data: {
          outputLang: 'katakana',
          text: sentence
        }
      }; 
      
      if (p==='both') {
        await axios.all([
          axios.request(options),
          axios.request(options2)])
        .then(axios.spread((h, k) => {
          outputs.push(String(h.data.result).replace(/、、 /g, '\n').replace(/、、/g, '\n').replace(/、 、 /g, '\n'));
          outputs.push(String(k.data.result).replace(/、、 /g, '\n').replace(/、、/g, '\n').replace(/、 、 /g, '\n'));
        }))
        .catch(err => {
          outputs.push(err)})
        
        return outputs        
      } else {
        options.data.outputLang = p
        
        await axios.request(options) 
        .then(r => {
          outputs.push(String(r.data.result).replace(/、、 /g, '\n').replace(/、、/g, '\n').replace(/、 、 /g, '\n'));
          }) 
        .catch(err => {
	      outputs.push(err)})
        
        return outputs 
      } 
    },
    createTranslation(o) {         
      let translation = [o[0],o[1],o[2],o[3]]
      
      this.translations.unshift(translation)
      if (this.translations.length>10) {this.translations.pop()}
      
      this.isTranslating = false
    },
    deleteTrans(i) {
      this.translations.splice(i,1)
      this.isDeleting = false;        
      setTimeout(()=>{this.isDeleting = true}, 10)     
    }
  },
  mounted() {
    if (localStorage.isToolsOn === 't') {this.isToolsOn = true} 
    else if (localStorage.isCreditsOn === 't') {this.isCreditsOn = true}
    if (localStorage.isToolsAlphaOn === 't') {this.isToolsAlphaOn = true}
    else if (localStorage.isToolsBetaOn === 't') {this.isToolsBetaOn = true}
    if (localStorage.isTranslatorOn === 't') {this.isTranslatorOn = true}
    if (localStorage.isAdvancedOn === 't') {this.isAdvancedOn = true} 
       
    let _this = this
    
    function onFocusout() {
      _this.$refs.form.setAttribute("style", 
        "font-size: 18px; border-radius: 3px; width: calc(80vw - 2px); height: 30px; opacity: 100%; position: absolute; bottom: 1px; left: -1px;");
      _this.$refs.form.style.removeProperty('z-index');
      _this.$refs.form.style.removeProperty('display');
      _this.$refs.form.style.removeProperty('box-shadow');
      
      _this.$refs.btn.setAttribute("style", 
        "opacity: 100%; pointer-events: auto;");      
    }
    
    function onFocusin() {
      if (_this.isMobileKeyboardAideOn === false) {return}
      
      _this.$refs.form.setAttribute("style", 
        "font-size: 22px; border-radius: 0px; width: 100%; height: 50px; opacity: 98%; position: fixed; bottom: 0; left: 0; display: flex; justify-content: space-evenly; z-index: 3; box-shadow: rgba(17, 17, 26, 0.8) 0px 4px 16px;");  
      
      _this.$refs.btn.setAttribute("style", 
        "opacity: 0%; pointer-events: none;");
    }
    
    if (localStorage.isMobileKeyboardAideOn === 'f') {this.isMobileKeyboardAideOn = false}
    else {
      localStorage.isMobileKeyboardAideOn = 't';
      this.isMobileKeyboardAideOn = true;}
      
    this.$refs.form.addEventListener('focusin', onFocusin)
    this.$refs.form.addEventListener('focusout', onFocusout)
  },
  watch: {
  overlayhelp: function() {if(this.overlayhelp===false) {this.btnAnimate = null;this.isDeleting = null;}}
    }
})  
  
  
let app = new Vue ({
  el: '#app',
  data: { 
    mode: 1,
    overlayhelp: true,
    overlayload: true,
    isloadingmodel: true,
    cards: [],
    labelsCreated: 0,
    topcards: [],
    isOrderLocked: false,
    renderlimited: false,
    isKanjiOn: false,
    isHiraOn: false,
    isKataOn: false,
    isChineseOn: false,
    countIndex: 0,
    activeLang: 'none'
  },
  methods: {
    toggleFullscreen() {
      let elem = document.documentElement;
      if (!document.fullscreenElement &&
    !document.webkitFullscreenElement && !document.msFullscreenElement && !document.mozFullScreenElement) {
        if (elem.requestFullscreen) {
          elem.requestFullscreen();
        } else if (elem.webkitRequestFullscreen) { //Safari
          elem.webkitRequestFullscreen();
        } else if (elem.msRequestFullscreen) { //IE11
          elem.msRequestFullscreen();
        } else if (elem.mozRequestFullScreen) { //Mozilla
          elem.mozRequestFullScreen();
        }
      } else {
        if (document.exitFullscreen) {
          document.exitFullscreen();
        } else if (document.webkitExitFullscreen) { 
          document.webkitExitFullscreen();
        } else if (document.msExitFullscreen) { 
          document.msExitFullscreen();
        } else if (document.mozCancelFullScreen) {
          document.mozCancelFullScreen();
        }
      }
      this.fullscreenTrigger = !this.fullscreenTrigger
    },
    updateMode(mode) {
      this.mode = mode;
      this.overlayhelp = false
      this.overlayload = false        
    },
    toggleOverlay(alt) {
      if (alt) {
        this.overlayload = false;
      } else if (!this.isloadingmodel) {
        this.overlayhelp = !this.overlayhelp;
        this.overlayload = false;        
      }
    },
    toggleLang(l,resetBool) {
      if (l==='kanji') {this.isKanjiOn = !this.isKanjiOn} 
      else if (l==='hira') {this.isHiraOn = !this.isHiraOn}
      else if (l==='kata') {this.isKataOn = !this.isKataOn}
      else if (l==='chinese') {this.isChineseOn = !this.isChineseOn}
      
      this.toggleActiveLang(resetBool)
    },
    async updateCardOrder(id) {
      if (!this.isOrderLocked) {
        this.isOrderLocked = true;
      
        for (let i = this.cards.length-1; i >= 0; i--) {
          if (this.cards[i].id === id) {
            let x = await this.cards.splice(i, 1);
            this.cards = await x.concat(this.cards);//
          }
        }     
        this.topcards = await this.cards.slice(-10);
      
        this.isOrderLocked = false; 
      }
    },
    async updateCardOrderTopToBottom() {
      if (!this.isOrderLocked) {      
        this.isOrderLocked = true;
      
        let x = await this.cards.splice(this.cards.length-1, 1);
        this.cards = await x.concat(this.cards);
      
        this.topcards = await this.cards.slice(-10);
      
        this.isOrderLocked = false;     
      }  
    },
    async updateCardOrderBottomToTop() {
      if (!this.isOrderLocked) {       
        this.isOrderLocked = true;
      
        let x = await this.cards.splice(0, 1);
        this.cards = await this.cards.concat(x);
      
        this.topcards = await this.cards.slice(-10);
      
        this.isOrderLocked = false;
      }
    },
    async deleteCard(id) {
      if (!this.isOrderLocked) {
        this.isOrderLocked = true;
      
        for (let i = this.cards.length-1; i >= 0; i--) {
          if (this.cards[i].id === id) {
            let x = await this.cards.splice(i, 1);
          }
        } 
        this.topcards = await this.cards.slice(-10);
        
        if (this.cards.length>10) {
          this.renderlimited = true;
        } else {
          this.renderlimited = false;  
        }                
        this.isOrderLocked = false; 
      }
    },  
    async newPred(labels) {
      this.isOrderLocked = true;
           
      for (let i = 0; i < labels.length; i++) {
        labels[i].id = await this.labelsCreated;
        this.labelsCreated++;
        let frozenLabel = await Object.freeze(labels[i]);     
        await this.cards.push(frozenLabel);
        
        if (i===labels.length-1) {
          this.topcards = await this.cards.slice(-10);
          
          if (this.cards.length>10) {
            this.renderlimited = true;
          } else {
            this.renderlimited = false;  
          }         
          this.isOrderLocked = false;
        }        
      }
    },
    toggleActiveLang(resetBool) {
      let langs = []      
      if (this.isKanjiOn === true) {langs.push('kanji')}
      if (this.isHiraOn === true) {langs.push('hira')} 
      if (this.isKataOn === true) {langs.push('kata')} 
      if (this.isChineseOn === true) {langs.push('chinese')}    
      
      if (langs.length===0) {this.activeLang='none'; localStorage.activeLang='none'; return}
      
      this.countIndex++
      if (resetBool || this.countIndex>langs.length-1) {this.countIndex=0}
      this.activeLang = langs[this.countIndex]
      localStorage.activeLang = this.activeLang
    },
    async loadModel() {
      net = await mobilenet.load();
      
      if (!(localStorage.getItem('Tench, tinca tinca'))) {        
        for (let key of Object.keys(rdyTranslations)) {
          await localStorage.setItem(key, rdyTranslations[key])
        }
      }
      
      this.isloadingmodel = false;
      if (localStorage.isToolsOn === 't' || localStorage.isCreditsOn === 't' || localStorage.isTranslatorOn === 't' || localStorage.isAdvancedOn === 't') {
        this.overlayload = false
      }
    }
  },
  mounted() {
    this.loadModel();
    if (localStorage.isKanjiOn === 't') {this.isKanjiOn = true}
    if (localStorage.isHiraOn === 't') {this.isHiraOn = true} 
    if (localStorage.isKataOn === 't') {this.isKataOn = true} 
    if (localStorage.isChineseOn === 't') {this.isChineseOn = true}
    if (localStorage.activeLang) {this.activeLang = localStorage.activeLang}
  }
})  

}
