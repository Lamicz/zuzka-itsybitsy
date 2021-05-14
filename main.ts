let i: int16 = 0
let x: int16 = 0
let y: uint8 = 0
let isValid: boolean = false

let stripFreePositions: number[] = []
let pixelsMode0Current: uint8 = 11
let pixelsMode0CurrentPixels: uint8 = 0
let pixelsMode1Current: uint8 = 5
let pixelsMode1CurrentPixels: uint8 = 0
let pixelWaitCyclesMode1: uint8 = 40

const stripLength: uint8 = 20
const pixelsMiddle: Buffer = Buffer.fromArray([8, 9, 10, 11]) // counting from 0
const pixelsMiddleMinBrightnessPool: Buffer = Buffer.fromArray([75, 110])
const pixelsMode0: Buffer = Buffer.fromArray([8, 13])
const pixelsMode0Max: uint8 = 13
const pixelMode0MaxBrightness: Buffer = Buffer.fromArray([85, 255])
const pixelsMode1: Buffer = Buffer.fromArray([1, 6])
const pixelsMode1Max: uint8 = 6
const pixelWaitCyclesMode0: uint8 = 4
const pixelWaitCyclesMode1Pool: Buffer = Buffer.fromArray([20, 50])
const pixelStepChangeBrightnessMode02: Buffer = Buffer.fromArray([4, 8]);
const pixelColor: Buffer = Buffer.fromArray([154, 248, 251]);
const strip = light.createNeoPixelStrip(pins.D5, stripLength, NeoPixelMode.RGBW)


const onboardLed = light.createAPA102Strip(pins.pinByCfg(DAL.CFG_PIN_DOTSTAR_DATA), pins.pinByCfg(DAL.CFG_PIN_DOTSTAR_CLOCK), config.NUM_DOTSTARS)
onboardLed.setBrightness(85)
onboardLed.setPixelColor(0, pixel.rgb(255, 0, 0))
onboardLed.show()


class Pixel {

    timer: uint8 = 0;
    status: uint8 = 0;
    mode: uint8 = 0; // 0 - RGB fade, 1 - white blink, 2 - middle fade
    position: uint8 = 0;
    wait: uint8 = 0;
    currentBrightness: int16 = 0;
    currentBrightnessImmutable: uint8 = 0;
    brightnessStep: uint8 = 0;
    maxBrightness: uint8 = 0;

    constructor(mode: number, pos: number = 0) {

        this.mode = mode;
        this.position = pos
        this.wait = (mode == 0) ? pixelWaitCyclesMode0 : pixelWaitCyclesMode1;
    }
}

let pixels: Pixel[] = [];

strip.setBuffered(true)
strip.setBrightness(255)

//stripTest()

stripReset()

forever(function () {
    if (control.timer1.seconds() > 15) {
        control.timer1.reset()
        pixelsMode0Current = Math.randomRange(pixelsMode0.getUint8(0), pixelsMode0.getUint8(1))
    }

    if (control.timer2.seconds() > 10) {
        control.timer2.reset()

        pixelsMode1Current = Math.randomRange(pixelsMode1.getUint8(0), pixelsMode1.getUint8(1))
        pixelWaitCyclesMode1 = Math.randomRange(pixelWaitCyclesMode1Pool.getUint8(0), pixelWaitCyclesMode1Pool.getUint8(1))
    }

    pixels.forEach(function (eggPixel: Pixel) {

        if (eggPixel.status > 0) {
            pixelProcess(eggPixel);
        } else {
            pixelCreate(eggPixel)
        }
    })
    strip.show()
})

function pixelProcess(eggPixel: Pixel) {
    if (eggPixel.timer > 0) {

        if (eggPixel.timer > eggPixel.wait) {
            eggPixel.status = 2
            eggPixel.timer = 0
        } else {
            eggPixel.timer++
        }
    }

    if ((eggPixel.mode == 0) || (eggPixel.mode == 2)) {

        if (eggPixel.status < 3) {

            if (eggPixel.status == 1) {

                eggPixel.currentBrightness += eggPixel.brightnessStep

                if (eggPixel.currentBrightness >= eggPixel.maxBrightness) {
                    eggPixel.timer = 1
                    eggPixel.status = 3
                    eggPixel.currentBrightness = eggPixel.maxBrightness
                }

            } else {

                eggPixel.currentBrightness -= eggPixel.brightnessStep

                if (eggPixel.currentBrightness < 0) {
                    eggPixel.currentBrightness = 0
                }
            }

            if (eggPixel.mode == 2) {

                strip.setPixelWhiteLED(eggPixel.position, eggPixel.currentBrightness)
            }

            strip.setPixelColor(
                eggPixel.position,
                pixel.rgb(pixelColor.getUint8(0) * eggPixel.currentBrightness / 255, pixelColor.getUint8(1) * eggPixel.currentBrightness / 255, pixelColor.getUint8(2) * eggPixel.currentBrightness / 255)
            )

            if ((eggPixel.mode == 2) && (eggPixel.status == 2) && (eggPixel.currentBrightness <= eggPixel.currentBrightnessImmutable)) {
                eggPixel.currentBrightness = 0
            }
        }
    }

    if (eggPixel.mode == 1) {

        if (eggPixel.status == 1) {

            eggPixel.timer = 1
            eggPixel.status = 3
        }

        if (eggPixel.status == 2) {

            if (eggPixel.currentBrightness == 0) {

                strip.setPixelWhiteLED(eggPixel.position, 255)

                eggPixel.currentBrightness = 255

            } else {

                strip.setPixelWhiteLED(eggPixel.position, 0)

                eggPixel.currentBrightness = 0
            }
        }
    }

    if ((eggPixel.currentBrightness == 0) && (eggPixel.status == 2)) {

        eggPixel.status = 0

        if (eggPixel.mode == 0) {

            stripFreePositions.push(eggPixel.position);
            pixelsMode0CurrentPixels--
        }

        if (eggPixel.mode == 1) {

            pixelsMode1CurrentPixels--
        }
    }
}

function pixelCreate(eggPixel: Pixel) {

    isValid = true

    if (eggPixel.mode == 0) {
        isValid = pixelsMode0CurrentPixels < pixelsMode0Current
    }

    if (eggPixel.mode == 1) {
        isValid = Math.random() > 0.5 && pixelsMode1CurrentPixels < pixelsMode1Current
    }

    if (isValid) {

        if (eggPixel.mode == 0) {

            pixelsMode0CurrentPixels++

            eggPixel.position = stripFreePositions[Math.randomRange(0, stripFreePositions.length - 1)];
            stripFreePositions.removeElement(eggPixel.position);

            eggPixel.brightnessStep = Math.randomRange(pixelStepChangeBrightnessMode02.getUint8(0), pixelStepChangeBrightnessMode02.getUint8(1))
            eggPixel.maxBrightness = Math.randomRange(pixelMode0MaxBrightness.getUint8(0), pixelMode0MaxBrightness.getUint8(1))
        }

        if (eggPixel.mode == 1) {

            pixelsMode1CurrentPixels++

            eggPixel.position = Math.randomRange(0, stripLength - 1)
            
            while (pixelsMiddle.toArray(NumberFormat.UInt8BE).indexOf(eggPixel.position) > -1) {
                eggPixel.position = Math.randomRange(0, stripLength - 1)
            }            
        }

        if (eggPixel.mode == 2) {

            eggPixel.brightnessStep = Math.randomRange(pixelStepChangeBrightnessMode02.getUint8(0), pixelStepChangeBrightnessMode02.getUint8(1))
            eggPixel.currentBrightness = Math.randomRange(pixelsMiddleMinBrightnessPool.getUint8(0), pixelsMiddleMinBrightnessPool.getUint8(1))
            eggPixel.currentBrightnessImmutable = eggPixel.currentBrightness
            eggPixel.maxBrightness = 255
        }

        eggPixel.status = 1
    }
}

function stripReset() {
    strip.clear()

    pixels = []
    stripFreePositions = []

    control.timer1.reset()
    control.timer2.reset()

    // fade mode
    i = x = 0
    while (x < pixelsMode0Max) {
        pixels[i] = new Pixel(0);
        i++
        x++
    }

    // white blink
    x = 0
    while (x < pixelsMode1Max) {
        pixels[i] = new Pixel(1);
        i++
        x++
    }

    // middle pixels
    x = 0
    for (x = 0; x < pixelsMiddle.length; x++) {
        pixels[i] = new Pixel(2, pixelsMiddle.getUint8(x))
        i++
    }

    // set all positions free excluding middle pixels
    x = 0
    while (x < stripLength) {

        if (pixelsMiddle.toArray(NumberFormat.UInt8BE).indexOf(x) > -1) {
            x++
            continue
        }

        stripFreePositions.push(x);
        x++;
    }
}

function stripTest() {
    for (i = 0; i < stripLength; i++) {

        strip.setPixelColor(i, pixel.rgb(255, 0, 0))
        strip.show()
        pause(500)
        strip.clear()

        strip.setPixelColor(i, pixel.rgb(0, 255, 0))
        strip.show()
        pause(500)
        strip.clear()

        strip.setPixelColor(i, pixel.rgb(0, 0, 255))
        strip.show()
        pause(500)
        strip.clear()

        strip.setPixelWhiteLED(i, 255)
        strip.show()
        pause(500)
        strip.clear()
    }
}