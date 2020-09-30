const { exec } = require('child_process')
const { promisify } = require('util')
const Joi = require('@hapi/joi')
const axios = require('axios')
const { promises : { writeFile, readFile, unlink }} = require('fs')
const decoratorValidator = require('./util/decorator/Validator')
const shell = promisify(exec)

class Handler {
  constructor(){}

  static validator(){
    return Joi.object({
      image: Joi.string().uri().required(),
      topText: Joi.string().max(200).required(),
      bottomText: Joi.string().max(200).optional()
    })
  }

  static generateImgPath(){

    const isLocal = process.env.IS_LOCAL
    return `${isLocal ? "" : "/tmp/"}${new Date().getTime()}-out.png`

  }

  static async saveImageLocally(imageUrl, imagePath) {
    const { data } = await axios.get(imageUrl, { responseType: 'arraybuffer' })
    const buffer = Buffer.from(data, 'base64')
    
    await writeFile(imagePath, buffer)
   
  }

  static generateIdentifyCommmand(imagePath){
  
    const value = `
    gm identify \
    -verbose \
    ${imagePath}
    `
    const cmd = value.split('\n').join(' ')
    return cmd
  }

  static async getImageSize(imagePath){
    
    const command = Handler.generateIdentifyCommmand(imagePath)
  
    const{ stdout } = await shell(command)
    const [line] = stdout.trim().split('\n').filter( text => ~text.indexOf('Geometry'))
    const [ width, height] = line.trim().replace('Geometry:', '').split('x')
   
    return{
      width: Number(width),
      height: Number(height)
    }

  }

  static setParameters(options, dimensions, imagePath){
    return{
      topText : options.topText,
      bottomText: options.bottomText,
      font: __dirname + './resources/impact.ttf',
      fontSize: dimensions.width / 8,
      fontFill: '#FFF',
      textPos: 'center',
      strokeColor: '#000',
      strokeWeight: 1,
      padding: 40,
      imagePath
    }
  }
  static setTextPositions(dimensions, padding){
    const top = Math.abs((dimensions.height / 2.1) - padding) * -1
    const bottom = (dimensions.height / 2.1) - padding

    return {
      top, 
      bottom
    }
  
  }
  static async generatorConvertCommand(option, finalPath){
    const value = `
      gm convert
      '${option.imagePath}'
      -font '${option.font}'
      -pointsize ${option.fontSize}
      -fill '${option.fontFill}'
      -stroke '${option.strokeColor}'
      -strokeWidth ${option.strokeWeight}
      -draw 'gravity ${option.textPos} text 0, ${option.top} "${option.topText}"'
      -draw 'gravity ${option.textPos} text 0, ${option.bottom} "${option.bottomText}"'
      ${finalPath}
    `

    const final = value.split('\n').join(' ')
    console.log('HERE==>', final)
    const { stdout } = await shell(final)
    return stdout
  }

  static async generateBase64(imagePath){
    return readFile(imagePath, "base64")
  }

  static async main(event){
    try {

      const option = event.queryStringParameters

      console.log('Downloading image...')

      const imagePath = Handler.generateImgPath()

      await Handler.saveImageLocally(option.image, imagePath)

      console.log('getting image size...')

      const dimensions = await Handler.getImageSize(imagePath)

      const params = Handler.setParameters(option, dimensions ,imagePath)
      
      const { top, bottom } = Handler.setTextPositions(dimensions, params.padding)
      const finalPath = Handler.generateImgPath()

      console.log('Generating meme image ...')

      const command = await Handler.generatorConvertCommand({ 
        ...params,
        top, 
        bottom 
      }, finalPath)
     
      console.log('Generating base64...')
      
      const imgBuffer = await Handler.generateBase64(finalPath)

      console.log('Finishing...')

      await Promise.all([
        unlink(imagePath),
        unlink(finalPath)
      ])

      const response = {
        statusCode: 200,
        headers:{
          'Content-Type':'text/html'
        },
        body:`<img src="data:image/jpeg;base64,${imgBuffer}">`
      }

      return response

    } catch (error) {
      console.error('ERROR ', error)
      return{
        statusCode:500,
        body: error.stack
      }
    }
  }
}
const GlobalEnum = require('./util/globalEnum')
module.exports = {mememaker:decoratorValidator(Handler.main, Handler.validator() , GlobalEnum.ARG_TYPE.QUERYSTRING)}
