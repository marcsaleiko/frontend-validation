window.$ = window.jQuery = require('jquery');

module.exports = FrontendValidation = ( function(){

  let app = {}
  let settings = {
    elementSelector: '.js-form-element-required',
    nextBtnSelector: '.js-booking-form-next',
    formSelector: '.js-form',
    formButtonRowSelector: '.js-form-btn-row',
    formSubmittedTextSelector: '.js-form-submitted-text',
    requiredHintSelector: '.required-field',
    requiredDefaultHtml: 'Pflichtfeld',
    requiredErrorHtml: 'Eingabe nicht korrekt',
    requiredValidHtml: '<svg class="required-field-icon icon icon--sm icon--adjusted-top"><use xlink:href="/build/images/icons.svg#icon-check"></use></svg>',
    requiredValidClass: 'required-field--valid',
    requiredErrorClass: 'required-field--error',
    conditionalElementsTriggerSelector: '.js-conditional-fields-trigger',
    conditionalElementsHiddenClass: 'd-none'
  }
  let requiredElementsCount = 0
  let $requiredElements = false
  let $conditionalElementsTrigger = false
  let $form = false
  let $nextBtn = false
  let featureDateInputField = false

  app.init = () => {
    $requiredElements = $( settings.elementSelector )
    $conditionalElementsTrigger = $( settings.conditionalElementsTriggerSelector )
    $nextBtn = $( settings.nextBtnSelector )
    $form = $( settings.formSelector )

    $conditionalElementsTrigger.on('change', onConditionalElementsTriggerChange )

    featureDateInputField = checkInput("date")

    preflightElements()
    evalElements()

    $requiredElements.on('change', onElementChange )
    $requiredElements.each( function() {
        const $this = $( this )
        if( typeof $this.data('allow') !== 'undefined' ) {
          if( $this.data('allow') === 'numbers' ) {
            $this.on('keypress', onElementKeyPressAllowNumber )
          }
          else if( $this.data('allow') === 'alphanumeric' ) {
            $this.on('keypress', onElementKeyPressAllowAlphanumeric )
          }
          else if( $this.data('allow') === 'phone' ) {
            $this.on('keypress', onElementKeyPressAllowPhone )
          }
        }
    })
    $form.on('submit', onFormSubmit )
    // for now quick solution which updates all items each 1.2 secs
    // maybe we will later add another solution that uses timeouts on elements
    window.setInterval( function() {
        app.update()
    }, 1200 )
  }

  app.update = function() {
    evalElements()
  }

  const onElementChange = function( e ) {
    const $this = $(this)
    $this.data('touched', true)
    evalElement($this)
    updateElementsCount()
    updateNextBtn()
  }

  const onElementKeyPressAllowNumber = function( e ) {
    return isNumber( e );
  }

  const onElementKeyPressAllowAlphanumeric = function( e ) {
    return isAlphaNumeric( e )
  }

  const onElementKeyPressAllowPhone = function( e ) {
    return isPhone( e );
  }

  const onFormSubmit = function( e ) {
    // make transformations to submitted data
    transformElementsOnSubmit()
    $nextBtn.attr('disabled', 'disabled')
    $( settings.formButtonRowSelector ).addClass('d-none')
    $( settings.formSubmittedTextSelector ).removeClass('d-none')
  }

  const onConditionalElementsTriggerChange = function( e ) {
    const $this = $(this)
    let oldValid = $this.data('valid')
    if( typeof oldValid === 'undefined' ) {
      oldValid = false
      $this.data('valid', false)
    }
    valid = evalElement( $this )
    if( oldValid !== valid ) {
      $conditionalElements = getConditionalElementsSelector( $this )
      if( valid ) {
        $conditionalElements.removeClass( settings.conditionalElementsHiddenClass )
      }
      else {
        $conditionalElements.addClass( settings.conditionalElementsHiddenClass )
      }
      // update our required fields
      evalElements()
    }
  }

  const evalElement = function( $this, doNotUpdateRequiredHint ) {
    // bail early if we have conditions for evaluation
    if( typeof $this.data('validate') !== 'undefined' && $this.data('validate') === false ) {
      return true
    }
    if( typeof $this.data('onlyValidateWhenChecked') !== 'undefined' ) {
      let $conditionElement = $this.data('onlyValidateWhenCheckedElement')
      if( typeof $conditionElement === 'undefined') {
        $conditionElement = $( $this.data('onlyValidateWhenChecked') )
        $this.data('onlyValidateWhenCheckedElement', $conditionElement )
      }
      if( !$conditionElement.find('input').is(':checked') ) {
        return true
      }
    }
    let type = 'text'
    let valid = false
    let validateInput = false
    let error = false
    let errorHtmlOverride = false
    let oldValid = getLastValidDataOfElement( $this )
    let oldError = getLastErrorDataOfElement( $this )
    let alwaysRebuildUi = false
    if( typeof $this.data('type') !== 'undefined' ) {
      type = $this.data('type')
    }
    if( typeof  $this.data('validate') !== 'undefined' ) {
      validateInput = $this.data('validate')
    }
    if( type === 'text' ) {
      let value = $this.find('input').val()
      valid = value !== ''
      if( valid ) {
        if( validateInput === 'email' && /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(value) === false ) {
            error = true
            valid = false
        }
        if( validateInput === 'iban' ) {
          if( hasIBANGermanCountryCode( value ) === false ) {
            error = true
            valid = false
            errorHtmlOverride = 'Kein deutsches Konto'
          }
          else if( isValidIBANNumber(value) === false ) {
            error = true
            valid = false
            errorHtmlOverride = 'IBAN nicht korrekt'
          }
        }
        if( validateInput === 'date' ) {
          let date = transformToDate( value )
          if( date !== null ) {
            if( inDateRange( date ) ) {
              let maxDate = $this.data('validateMax')
              let minDate = $this.data('validateMin')
              let needsMinMaxValidation = false
              if( typeof minDate !== 'undefined' && minDate !== '' ) {
                needsMinMaxValidation = true
                minDate = new Date( minDate )
                if( date.getTime() < minDate.getTime() ) {
                  valid = true
                }
                else {
                  error = true
                  valid = false
                  errorHtmlOverride = 'Bitte geben Sie ein früheres Datum ein'
                  if( typeof $this.data('validateMinError') !== 'undefined' && $this.data('validateMinError') !== '' ) {
                    errorHtmlOverride = $this.data('validateMinError');
                  }
                  alwaysRebuildUi = true
                }
              }
              if( typeof maxDate !== 'undefined' && maxDate !== '' ) {
                needsMinMaxValidation = true
                maxDate = new Date( maxDate )
                if( date.getTime() > maxDate.getTime() ) {
                  valid = true
                }
                else {
                  error = true
                  valid = false
                  errorHtmlOverride = 'Das Datum liegt vor dem Referenzdatum.'
                  if( typeof $this.data('validateMaxError') !== 'undefined' && $this.data('validateMaxError') !== '' ) {
                    errorHtmlOverride = $this.data('validateMaxError');
                  }
                  alwaysRebuildUi = true
                }
              }
              if( !needsMinMaxValidation ) {
                valid = true
              }
            }
            else {
              error = true
              valid = false
              errorHtmlOverride = 'Kein gültiger Datumsbereich'
              alwaysRebuildUi = true
            }
          }
          else {
            error = true
            valid = false
            errorHtmlOverride = 'Kein gültiges Datum'
            alwaysRebuildUi = true
          }
        }
      }
    }
    else if ( type === 'check' ) {
      // at least one checkbox/radio is checked
      valid = $this.find('input').is(':checked')
    }
    else if ( type === 'select' ) {
      // select exists and its value is something other than an empty string
      valid = $this.find('select').val() !== ''
    }

    // only do something if this valid state differs from
    // previous valid state
    if ( typeof doNotUpdateRequiredHint !== 'undefined' && doNotUpdateRequiredHint === true ||
         oldValid !== valid ||
         oldError !== error ||
         alwaysRebuildUi )
    {
      let $requiredHint = getRequiredHintElement( $this )
      if (valid)
      {
        $requiredHint
          .html(settings.requiredValidHtml)
          .removeClass(settings.requiredErrorClass)
          .addClass(settings.requiredValidClass)
      } else
      {
        if( error ) {
          let errorHtml = settings.requiredErrorHtml
          if( typeof $this.data('errorHtml') !== 'undefined' ) {
            errorHtml = $this.data('errorHtml')
          }
          if( errorHtmlOverride !== false ) {
            errorHtml = errorHtmlOverride
          }
          $requiredHint
            .html(errorHtml)
            .removeClass(settings.requiredValidClass)
            .addClass(settings.requiredErrorClass)
        }
        else {
          $requiredHint
            .html(settings.requiredDefaultHtml)
            .removeClass(settings.requiredValidClass, settings.requiredErrorClass)
        }
      }
    }
    $this.data('valid', valid )
    $this.data('error', error )
    return valid
  }

  const getRequiredHintElement = function( $this ) {
    let $req = $this.data('requiredHint')
    if( typeof $req === 'undefined' ) {
      $req = $this.find(settings.requiredHintSelector)
      $this.data('requiredHint', $req)
    }
    return $req
  }

  const getConditionalElementsSelector = function( $this ) {
    let $elements = $this.data('conditionalElements')
    if( typeof $elements === 'undefined' ) {
      $elements = $( $this.data('conditionalElementsSelector') )
      $this.data('conditionalElements', $elements)
    }
    return $elements
  }

  const getLastValidDataOfElement = function( $this ) {
    let valid = $this.data('valid')
    if( typeof valid === 'undefined' ) {
      valid = false
      $this.data('valid', valid)
    }
    return valid
  }

  const getLastErrorDataOfElement = function( $this ) {
    let error = $this.data('error')
    if( typeof error === 'undefined' ) {
      error = false
      $this.data('error', error)
    }
    return error
  }

  const updateNextBtn = () => {
    if( requiredElementsCount > 0 ) {
      $nextBtn.addClass('disabled').attr('disabled', 'disabled')
    }
    else {
      $nextBtn.removeClass('disabled').removeAttr('disabled')
    }
  }

  const evalElements = () => {
    if( $requiredElements.length > 0 ) {
      requiredElementsCount = 0
      $requiredElements.each( function() {
        if( !evalElement( $(this) ) ) {
          requiredElementsCount++;
        }
      });
      updateNextBtn()
    }
    console.log( "Required elements to proceed %i", requiredElementsCount );
  }

  const preflightElements = () => {
    if( $requiredElements.length > 0 ) {
      $requiredElements.each( function() {
        let $this = $(this)
        let type = 'text'
        if( typeof $this.data('type') !== 'undefined' ) {
          type = $this.data('type')
        }
        validateInput = false
        if( typeof  $this.data('validate') !== 'undefined' ) {
          validateInput = $this.data('validate')
        }
        let removeRequired = $this.data('removeRequired')
        if( typeof removeRequired !== 'undefined' && removeRequired ) {
          if( type === 'select' ) {
            $this.find('select').removeAttr('required')
          }
          else {
            $this.find('input').removeAttr('required')
          }
        }
        if( validateInput === "date" && !featureDateInputField ) {
          // assume we get format "Y-m-d" and transform to "d.m.Y"
          const $input = $this.find('input')
          let value = $input.val()
          if( value !== '' ) {
            let date = new Date( value )
            if( isValidDate( date ) ) {
              $input.val( formatGermanDate( date ) )
            }
          }
        }
      });
    }
  }

  const transformElementsOnSubmit = () => {
    if( $requiredElements.length > 0 ) {
      $requiredElements.each( function() {
        let $this = $(this)
        let type = 'text'
        if( typeof $this.data('type') !== 'undefined' ) {
          type = $this.data('type')
        }
        validateInput = false
        if( typeof  $this.data('validate') !== 'undefined' ) {
          validateInput = $this.data('validate')
        }
        if( validateInput === "date" && !featureDateInputField ) {
          // assume we get format "d.m.Y" and transform to "Y-m-d"
          const $input = $this.find('input')
          let value = $input.val()
          if( value !== '' ) {
            let date = transformToDate( value )
            if( isValidDate( date ) ) {
              $input.val( formatDate( date ) )
            }
          }
        }
      });
    }
  }

  const updateElementsCount = () => {
    requiredElementsCount = 0
    if( $requiredElements.length > 0 ) {
      $requiredElements.each( function(){
        if( $(this).data('valid') === false ) {
          requiredElementsCount++
        }
      })
    }
    console.log('updated required elements index %o', requiredElementsCount )
  }

  const isNumber = function(evt) {
    evt = (evt) ? evt : window.event
    var charCode = (evt.which) ? evt.which : evt.keyCode
    if (charCode > 31 && (charCode < 48 || charCode > 57)) {
      return false
    }
    return true
  }

  const isAlphaNumeric = function(evt) {
    evt = (evt) ? evt : window.event
    var charCode = (evt.which) ? evt.which : evt.keyCode
    if (!(charCode > 47 && charCode < 58) && // numeric (0-9)
      !(charCode > 64 && charCode < 91) && // upper alpha (A-Z)
      !(charCode > 96 && charCode < 123)) { // lower alpha (a-z)
      return false
    }
    return true
  }

  const isPhone = function(evt) {
    evt = (evt) ? evt : window.event
    var charCode = (evt.which) ? evt.which : evt.keyCode
    if (charCode > 31 && (charCode < 48 || charCode > 57) && charCode !== 43 ) {
      return false
    }
    return true
  }

  const transformToDate = function( value ) {
    let parsedDate = new Date( value );
    if( !isValidDate( parsedDate ) ) {
      if( value.indexOf('.') > -1 ) {
        let parts = value.split('.')
        console.log( parts, parts[2]+'-'+parts[1]+'-'+parts[0] )
        parsedDate = new Date(parts[2]+'-'+parts[1]+'-'+parts[0] )
        if( !isValidDate( parsedDate )) {
          parsedDate = null
        }
      }
    }
    return parsedDate
  }

  const inDateRange = function( d ) {
    let c = new Date('1905', 0, 1)
    // console.log(d.getTime(),c.getTime())
    return d.getTime() > c.getTime()
  }

  const isValidDate = function( d ) {
    return d instanceof  Date && !isNaN(d)
  }

  /*
   * Returns 1 if the IBAN is valid
   * Returns FALSE if the IBAN's length is not as should be (for CY the IBAN Should be 28 chars long starting with CY )
   * Returns any other number (checksum) when the IBAN is invalid (check digits do not match)
   */
  const isValidIBANNumber = function (input ) {
    var CODE_LENGTHS = {
      AD: 24, AE: 23, AT: 20, AZ: 28, BA: 20, BE: 16, BG: 22, BH: 22, BR: 29,
      CH: 21, CR: 21, CY: 28, CZ: 24, DE: 22, DK: 18, DO: 28, EE: 20, ES: 24,
      FI: 18, FO: 18, FR: 27, GB: 22, GI: 23, GL: 18, GR: 27, GT: 28, HR: 21,
      HU: 28, IE: 22, IL: 23, IS: 26, IT: 27, JO: 30, KW: 30, KZ: 20, LB: 28,
      LI: 21, LT: 20, LU: 20, LV: 21, MC: 27, MD: 24, ME: 22, MK: 19, MR: 27,
      MT: 31, MU: 30, NL: 18, NO: 15, PK: 24, PL: 28, PS: 29, PT: 25, QA: 29,
      RO: 24, RS: 22, SA: 24, SE: 24, SI: 19, SK: 24, SM: 27, TN: 24, TR: 26
    }
    // keep only alphanumeric characters
    var iban = String(input).toUpperCase().replace(/[^A-Z0-9]/g, '')
    // match and capture (1) the country code, (2) the check
    // digits, and (3) the rest
    let code = iban.match(/^([A-Z]{2})(\d{2})([A-Z\d]+)$/)
    let digits
    // check syntax and length
    if (!code || iban.length !== CODE_LENGTHS[code[1]])
    {
      return false
    }
    // rearrange country code and check digits, and convert chars to ints
    digits = (code[3] + code[1] + code[2]).replace(/[A-Z]/g, function (letter) {
      return letter.charCodeAt(0) - 55
    })
    // final check
    return mod97(digits)
  }

  const hasIBANGermanCountryCode = function( input ) {
    let code = String(input).toUpperCase().match(/^([A-Z]{2})(\d{2})([A-Z\d]+)$/)
    return code && code[1] === 'DE';
  }

  const mod97 = function (string) {
    var checksum = string.slice(0, 2), fragment
    for (var offset = 2; offset < string.length; offset += 7)
    {
      fragment = String(checksum) + string.substring(offset, offset + 7)
      checksum = parseInt(fragment, 10) % 97
    }
    return checksum
  }

  const checkInput = function(type) {
    var input = document.createElement("input");
    input.setAttribute("type", type);
    return input.type === type;
  }

  const formatGermanDate = function( date ) {
    let day = date.getDate()
    let month = date.getMonth()+1
    let year = date.getFullYear()
    if( day < 10 ) {
      day = '0'+day
    }
    if( month < 10 ) {
      month = '0'+month
    }
    return day+'.'+month+'.'+year
  }

  const formatDate = function( date ) {
    let day = date.getDate()
    let month = date.getMonth()+1
    let year = date.getFullYear()
    if( day < 10 ) {
      day = '0'+day
    }
    if( month < 10 ) {
      month = '0'+month
    }
    return year+'-'+month+'-'+day
  }

  return app

})()