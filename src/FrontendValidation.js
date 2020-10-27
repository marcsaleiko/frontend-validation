/*!
 * FrontendValidation v0.2.0
 * Frontend validation module
 * MIT License
 */
window.FrontendValidation = (function () {
  var app = {};
  var settings = {
    elementSelector: ".js-form-element-required",
    nextBtnSelector: ".js-booking-form-next",
    formSelector: ".js-form",
    formButtonRowSelector: ".js-form-btn-row",
    formSubmittedTextSelector: ".js-form-submitted-text",
    requiredHintSelector: ".required-field",
    requiredDefaultHtml: "Pflichtfeld",
    requiredErrorHtml: "Eingabe nicht korrekt",
    requiredValidHtml:
      '<svg class="required-field-icon icon icon--sm icon--adjusted-top"><use xlink:href="/build/images/icons.svg#icon-check"></use></svg>',
    requiredValidClass: "required-field--valid",
    requiredErrorClass: "required-field--error",
    conditionalElementsTriggerSelector: ".js-conditional-fields-trigger",
    conditionalElementsHiddenClass: "d-none",
  };
  var requiredElementsCount = 0;
  var $requiredElements = false;
  var $conditionalElementsTrigger = false;
  var $form = false;
  var $nextBtn = false;
  var featureDateInputField = false;

  app.init = function (options) {

    settings = $.extend(settings, options);

    $requiredElements = $(settings.elementSelector);
    $conditionalElementsTrigger = $(
      settings.conditionalElementsTriggerSelector
    );
    $nextBtn = $(settings.nextBtnSelector);
    $form = $(settings.formSelector);

    $conditionalElementsTrigger.on(
      "change",
      onConditionalElementsTriggerChange
    );

    featureDateInputField = checkInput("date");

    preflightElements();
    evalElements();

    $requiredElements.on("change", onElementChange);
    $requiredElements.each(function () {
      var $this = $(this);
      if (typeof $this.data("allow") !== "undefined") {
        if ($this.data("allow") === "numbers") {
          $this.on("keypress", onElementKeyPressAllowNumber);
        } else if ($this.data("allow") === "alphanumeric") {
          $this.on("keypress", onElementKeyPressAllowAlphanumeric);
        } else if ($this.data("allow") === "phone") {
          $this.on("keypress", onElementKeyPressAllowPhone);
        }
      }
    });
    $form.on("submit", onFormSubmit);
    // for now quick solution which updates all items each 1.2 secs
    // maybe we will later add another solution that uses timeouts on elements
    window.setInterval(function () {
      app.update();
    }, 1200);
  };

  app.update = function () {
    evalElements();
  };

  var onElementChange = function (e) {
    var $this = $(this);
    $this.data("touched", true);
    evalElement($this);
    updateElementsCount();
    updateNextBtn();
  };

  var onElementKeyPressAllowNumber = function (e) {
    return isNumber(e);
  };

  var onElementKeyPressAllowAlphanumeric = function (e) {
    return isAlphaNumeric(e);
  };

  var onElementKeyPressAllowPhone = function (e) {
    return isPhone(e);
  };

  var onFormSubmit = function (e) {
    // make transformations to submitted data
    transformElementsOnSubmit();
    $nextBtn.attr("disabled", "disabled");
    $(settings.formButtonRowSelector).addClass("d-none");
    $(settings.formSubmittedTextSelector).removeClass("d-none");
  };

  var onConditionalElementsTriggerChange = function (e) {

    var $this = $(this);

    var oldValid = $this.data("valid");
    if (typeof oldValid === "undefined") {
      oldValid = false;
      $this.data("valid", false);
    }

    var lastValue = $this.data('lastValue');
    if (typeof lastValue === "undefined") {
      lastValue = false;
      $this.data('lastValue', '');
    }

    var valid = evalElement($this);

    var $conditionalElements = false;
    var $conditionalDeselectElements = false;
    var type = 'text';
    var $element = false;
    var value = '';

    // get value of element
    if (typeof $this.data("type") !== "undefined") {
      type = $this.data("type");
    }
    if( type === 'check') {
      $element = $this.find("input:checked");
    }
    else if( type === 'text' ) {
      $element = $this.find('input');
    }
    else if( type === 'select' ) {
      $element = $this.find("select");
    }
    if( $element.length > 0 ) {
      value = $element.val();
    }

    if (oldValid !== valid || lastValue !== value ) {

      if( typeof $this.data('conditionalElementsSelector') !== 'undefined' ) {
        $conditionalElements = getConditionalElementsSelector($this);
      } else {
        $conditionalElements = getConditionalElementsSelector($element);
      }
      if( typeof $this.data('conditionalElementsSelectorCallback') !== 'undefined' ) {
        try {
          var selectorString = window[$this.data('conditionalElementsSelectorCallback')]($this, $element);
          if( selectorString !== '' ) {
            $conditionalElements = $(selectorString);
          }
        }
        catch (e) {
          console.warn("Could not run callback '%o'. Skipping.", e);
        }
      }

      if( typeof $this.data('conditionalElementsDeselector') !== 'undefined' ) {
        $conditionalDeselectElements = getConditionalDeselectElementsSelector($this);
      }
      else {
        $conditionalDeselectElements = getConditionalDeselectElementsSelector($element);
      }
      if( typeof $this.data('conditionalElementsDeselectorCallback') !== 'undefined' ) {
        try {
          var deselectorString = window[$this.data('conditionalElementsDeselectorCallback')]($this, $element);
          if( deselectorString !== '' ) {
            $conditionalDeselectElements = $(deselectorString);
          }
        }
        catch (e) {
          console.warn("Could not run callback '%o'. Skipping.", e);
        }
      }

      if( typeof $conditionalDeselectElements !== 'undefined' &&
          $conditionalDeselectElements !== false &&
          $conditionalDeselectElements.length > 0 ) {
        if( valid ) {
          $conditionalDeselectElements.addClass(
            settings.conditionalElementsHiddenClass
          );
          // now walk through each form field and add "ignore validation flag"
          $conditionalDeselectElements.find(settings.elementSelector).data('forceIgnoreValidation', true);
        }
      }

      if( typeof $conditionalElements !== 'undefined' &&
          $conditionalElements !== false &&
          $conditionalElements.length > 0) {
        if (valid) {
          $conditionalElements.removeClass(
            settings.conditionalElementsHiddenClass
          );
          // now walk through each form field and remove "ignore validation flag"
          $conditionalElements.find(settings.elementSelector).data('forceIgnoreValidation', false);
        } else {
          $conditionalElements.addClass(settings.conditionalElementsHiddenClass);

        }
      }

      // update our required fields
      evalElements();
    }
  };

  var evalElement = function ($this, doNotUpdateRequiredHint) {
    // bail early if we have conditions for evaluation
    if (
      typeof $this.data("validate") !== "undefined" &&
      $this.data("validate") === false
    ) {
      return true;
    }
    if (typeof $this.data("onlyValidateWhenChecked") !== "undefined") {
      var $conditionElement = $this.data("onlyValidateWhenCheckedElement");
      if (typeof $conditionElement === "undefined") {
        $conditionElement = $($this.data("onlyValidateWhenChecked"));
        $this.data("onlyValidateWhenCheckedElement", $conditionElement);
      }
      if (!$conditionElement.find("input").is(":checked")) {
        return true;
      }
    }
    // if elements were made invisible. skip them now!
    if( typeof $this.data('forceIgnoreValidation') !== 'undefined' &&
      $this.data('forceIgnoreValidation') === true ) {
      return true;
    }

    var type = "text";
    var valid = false;
    var validateInput = false;
    var error = false;
    var errorHtmlOverride = false;
    var oldValid = getLastValidDataOfElement($this);
    var oldError = getLastErrorDataOfElement($this);
    var alwaysRebuildUi = false;
    var value = '';
    if (typeof $this.data("type") !== "undefined" && $this.data("type") !== '') {
      type = $this.data("type");
    }
    if (typeof $this.data("validate") !== "undefined" && $this.data("validate") !== '' ) {
      validateInput = $this.data("validate");
    }
    if (type === "text")
    {
      value = $this.find("input").val();
      if (typeof value === 'string')
      {
        value = value.trim();
      }
      valid = value !== "";
      if (valid)
      {
        if (
          validateInput === "email" && /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(value) === false
        )
        {
          error = true;
          valid = false;
        }
        if (validateInput === "iban")
        {
          if (hasIBANGermanCountryCode(value) === false)
          {
            error = true;
            valid = false;
            errorHtmlOverride = "Kein deutsches Konto";
          } else if (isValidIBANNumber(value) === false)
          {
            error = true;
            valid = false;
            errorHtmlOverride = "IBAN nicht korrekt";
          }
        }
        if (validateInput === "date")
        {
          var date = transformToDate(value);
          if (date !== null)
          {
            if (inDateRange(date))
            {
              var maxDate = $this.data("validateMax");
              var minDate = $this.data("validateMin");
              var needsMinMaxValidation = false;
              var minDateValid = true;
              var maxDateValid = true;
              if (typeof minDate !== "undefined" && minDate !== "")
              {
                needsMinMaxValidation = true;
                minDate = new Date(minDate);
                if (date.getTime() < minDate.getTime())
                {
                  valid = true;
                } else
                {
                  error = true;
                  valid = false;
                  minDateValid = false;
                  errorHtmlOverride = "Bitte geben Sie ein früheres Datum ein";
                  if (
                    typeof $this.data("validateMinError") !== "undefined" &&
                    $this.data("validateMinError") !== ""
                  )
                  {
                    errorHtmlOverride = $this.data("validateMinError");
                  }
                  alwaysRebuildUi = true;
                }
              }
              if (typeof maxDate !== "undefined" && maxDate !== "")
              {
                needsMinMaxValidation = true;
                maxDate = new Date(maxDate);
                if (date.getTime() > maxDate.getTime())
                {
                  valid = true;
                } else
                {
                  error = true;
                  valid = false;
                  maxDateValid = false;
                  errorHtmlOverride = "Das Datum liegt vor dem Referenzdatum.";
                  if (
                    typeof $this.data("validateMaxError") !== "undefined" &&
                    $this.data("validateMaxError") !== ""
                  )
                  {
                    errorHtmlOverride = $this.data("validateMaxError");
                  }
                  alwaysRebuildUi = true;
                }
              }
              if (!needsMinMaxValidation)
              {
                valid = true;
              } else
              {
                if (minDateValid && maxDateValid)
                {
                  valid = true;
                } else
                {
                  valid = false;
                }
              }
            } else
            {
              error = true;
              valid = false;
              errorHtmlOverride = "Kein gültiger Datumsbereich";
              alwaysRebuildUi = true;
            }
          } else
          {
            error = true;
            valid = false;
            errorHtmlOverride = "Kein gültiges Datum";
            alwaysRebuildUi = true;
          }
        }
      }
    } else if (type === "textarea") {
      value = $this.find('textarea').val();
      valid = value.trim() !== '';
    } else if (type === "check") {
      // at least one checkbox/radio is checked
      valid = $this.find("input").is(":checked");
    } else if (type === "select") {
      // select exists and its value is something other than an empty string
      valid = $this.find("select").val() !== "";
    }

    // only do something if this valid state differs from
    // previous valid state
    if (
      (typeof doNotUpdateRequiredHint !== "undefined" &&
        doNotUpdateRequiredHint === true) ||
      oldValid !== valid ||
      oldError !== error ||
      alwaysRebuildUi
    ) {
      var $requiredHint = getRequiredHintElement($this);
      if (valid) {
        $requiredHint
          .html(settings.requiredValidHtml)
          .removeClass(settings.requiredErrorClass)
          .addClass(settings.requiredValidClass);
      } else {
        if (error) {
          var errorHtml = settings.requiredErrorHtml;
          if (typeof $this.data("errorHtml") !== "undefined") {
            errorHtml = $this.data("errorHtml");
          }
          if (errorHtmlOverride !== false) {
            errorHtml = errorHtmlOverride;
          }
          $requiredHint
            .html(errorHtml)
            .removeClass(settings.requiredValidClass)
            .addClass(settings.requiredErrorClass);
        } else {
          $requiredHint
            .html(settings.requiredDefaultHtml)
            .removeClass(
              settings.requiredValidClass,
              settings.requiredErrorClass
            );
        }
      }
    }
    $this.data("valid", valid);
    $this.data("error", error);
    return valid;
  };

  var getRequiredHintElement = function ($this) {
    var $req = $this.data("requiredHint");
    if (typeof $req === "undefined") {
      $req = $this.find(settings.requiredHintSelector);
      $this.data("requiredHint", $req);
    }
    return $req;
  };

  var getConditionalDeselectElementsSelector = function ($this) {
    if( $this === false ) { return false; }
    var $elements = $this.data("conditionalDeselectElements");
    if (typeof $elements === "undefined") {
      if( typeof $this.data("conditionalElementsDeselector") !== 'undefined' ) {
        $elements = $($this.data("conditionalElementsDeselector"));
        $this.data("conditionalDeselectElements", $elements);
      }
      else {
        $elements = $.noop();
        $this.data("conditionalDeselectElements", $.noop());
      }
    }
    return $elements;
  };

  var getConditionalElementsSelector = function ($this) {
    if( $this === false ) { return false; }
    var $elements = $this.data("conditionalElements");
    if (typeof $elements === "undefined") {
      if( typeof $this.data("conditionalElementsSelector") !== 'undefined' ) {
        $elements = $($this.data("conditionalElementsSelector"));
        $this.data("conditionalElements", $elements);
      }
      else {
        $elements = $.noop();
        $this.data("conditionalElements", $.noop());
      }
    }
    return $elements;
  };

  var getLastValidDataOfElement = function ($this) {
    var valid = $this.data("valid");
    if (typeof valid === "undefined") {
      valid = false;
      $this.data("valid", valid);
    }
    return valid;
  };

  var getLastErrorDataOfElement = function ($this) {
    var error = $this.data("error");
    if (typeof error === "undefined") {
      error = false;
      $this.data("error", error);
    }
    return error;
  };

  var updateNextBtn = function () {
    if (requiredElementsCount > 0) {
      $nextBtn.addClass("disabled").attr("disabled", "disabled");
    } else {
      $nextBtn.removeClass("disabled").removeAttr("disabled");
    }
  };

  var evalElements = function () {
    if ($requiredElements.length > 0) {
      requiredElementsCount = 0;
      var requiredElementsIds = '';
      $requiredElements.each(function () {
        if (!evalElement($(this))) {
          requiredElementsCount++;
          // requiredElementsIds += " "+$(this).attr('id');
        }
      });
      updateNextBtn();
    }
    console.log("Required elements to proceed %i %o", requiredElementsCount, requiredElementsIds);
  };

  var preflightElements = function () {
    // also trigger conditional elements once
    $conditionalElementsTrigger.each(function(){
      onConditionalElementsTriggerChange.call(this);
    });

    if ($requiredElements.length > 0) {
      $requiredElements.each(function () {
        var $this = $(this);
        var type = "text";
        if (typeof $this.data("type") !== "undefined") {
          type = $this.data("type");
        }
        validateInput = false;
        if (typeof $this.data("validate") !== "undefined") {
          validateInput = $this.data("validate");
        }
        var removeRequired = $this.data("removeRequired");
        if (typeof removeRequired !== "undefined" && removeRequired) {
          if (type === "select") {
            $this.find("select").removeAttr("required");
          } else {
            $this.find("input").removeAttr("required");
          }
        }
        if (validateInput === "date" && !featureDateInputField) {
          // assume we get format "Y-m-d" and transform to "d.m.Y"
          var $input = $this.find("input");
          var value = $input.val();
          if (value !== "") {
            var date = new Date(value);
            if (isValidDate(date)) {
              $input.val(formatGermanDate(date));
            }
          }
        }
      });
    }
  };

  var transformElementsOnSubmit = function () {
    if ($requiredElements.length > 0) {
      $requiredElements.each(function () {
        var $this = $(this);
        var type = "text";
        if (typeof $this.data("type") !== "undefined") {
          type = $this.data("type");
        }
        validateInput = false;
        if (typeof $this.data("validate") !== "undefined") {
          validateInput = $this.data("validate");
        }
        if (validateInput === "date" && !featureDateInputField) {
          // assume we get format "d.m.Y" and transform to "Y-m-d"
          var $input = $this.find("input");
          var value = $input.val();
          if (value !== "") {
            var date = transformToDate(value);
            if (isValidDate(date)) {
              $input.val(formatDate(date));
            }
          }
        }
      });
    }
  };

  var updateElementsCount = function () {
    requiredElementsCount = 0;
    if ($requiredElements.length > 0) {
      $requiredElements.each(function () {
        if ($(this).data("valid") === false) {
          requiredElementsCount++;
        }
      });
    }
    console.log("updated required elements index %o", requiredElementsCount);
  };

  var isNumber = function (evt) {
    evt = evt ? evt : window.event;
    var charCode = evt.which ? evt.which : evt.keyCode;
    if (charCode > 31 && (charCode < 48 || charCode > 57)) {
      return false;
    }
    return true;
  };

  var isAlphaNumeric = function (evt) {
    evt = evt ? evt : window.event;
    var charCode = evt.which ? evt.which : evt.keyCode;
    if (
      !(charCode > 47 && charCode < 58) && // numeric (0-9)
      !(charCode > 64 && charCode < 91) && // upper alpha (A-Z)
      !(charCode > 96 && charCode < 123)
    ) {
      // lower alpha (a-z)
      return false;
    }
    return true;
  };

  var isPhone = function (evt) {
    evt = evt ? evt : window.event;
    var charCode = evt.which ? evt.which : evt.keyCode;
    if (charCode > 31 && (charCode < 48 || charCode > 57) && charCode !== 43) {
      return false;
    }
    return true;
  };

  var transformToDate = function (value) {
    var parsedDate = new Date(value);
    if (!isValidDate(parsedDate)) {
      if (value.indexOf(".") > -1) {
        var parts = value.split(".");
        console.log(parts, parts[2] + "-" + parts[1] + "-" + parts[0]);
        parsedDate = new Date(parts[2] + "-" + parts[1] + "-" + parts[0]);
        if (!isValidDate(parsedDate)) {
          parsedDate = null;
        }
      }
    }
    return parsedDate;
  };

  var inDateRange = function (d) {
    var c = new Date("1905", 0, 1);
    // console.log(d.getTime(),c.getTime())
    return d.getTime() > c.getTime();
  };

  var isValidDate = function (d) {
    return d instanceof Date && !isNaN(d);
  };

  /*
   * Returns 1 if the IBAN is valid
   * Returns FALSE if the IBAN's length is not as should be (for CY the IBAN Should be 28 chars long starting with CY )
   * Returns any other number (checksum) when the IBAN is invalid (check digits do not match)
   */
  var isValidIBANNumber = function (input) {
    var CODE_LENGTHS = {
      AD: 24,
      AE: 23,
      AT: 20,
      AZ: 28,
      BA: 20,
      BE: 16,
      BG: 22,
      BH: 22,
      BR: 29,
      CH: 21,
      CR: 21,
      CY: 28,
      CZ: 24,
      DE: 22,
      DK: 18,
      DO: 28,
      EE: 20,
      ES: 24,
      FI: 18,
      FO: 18,
      FR: 27,
      GB: 22,
      GI: 23,
      GL: 18,
      GR: 27,
      GT: 28,
      HR: 21,
      HU: 28,
      IE: 22,
      IL: 23,
      IS: 26,
      IT: 27,
      JO: 30,
      KW: 30,
      KZ: 20,
      LB: 28,
      LI: 21,
      LT: 20,
      LU: 20,
      LV: 21,
      MC: 27,
      MD: 24,
      ME: 22,
      MK: 19,
      MR: 27,
      MT: 31,
      MU: 30,
      NL: 18,
      NO: 15,
      PK: 24,
      PL: 28,
      PS: 29,
      PT: 25,
      QA: 29,
      RO: 24,
      RS: 22,
      SA: 24,
      SE: 24,
      SI: 19,
      SK: 24,
      SM: 27,
      TN: 24,
      TR: 26,
    };
    // keep only alphanumeric characters
    var iban = String(input)
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");
    // match and capture (1) the country code, (2) the check
    // digits, and (3) the rest
    var code = iban.match(/^([A-Z]{2})(\d{2})([A-Z\d]+)$/);
    var digits;
    // check syntax and length
    if (!code || iban.length !== CODE_LENGTHS[code[1]]) {
      return false;
    }
    // rearrange country code and check digits, and convert chars to ints
    digits = (code[3] + code[1] + code[2]).replace(/[A-Z]/g, function (letter) {
      return letter.charCodeAt(0) - 55;
    });
    // final check
    return mod97(digits);
  };

  var hasIBANGermanCountryCode = function (input) {
    var code = String(input)
      .toUpperCase()
      .match(/^([A-Z]{2})(\d{2})([A-Z\d]+)$/);
    return code && code[1] === "DE";
  };

  var mod97 = function (string) {
    var checksum = string.slice(0, 2),
      fragment;
    for (var offset = 2; offset < string.length; offset += 7) {
      fragment = String(checksum) + string.substring(offset, offset + 7);
      checksum = parseInt(fragment, 10) % 97;
    }
    return checksum;
  };

  var checkInput = function (type) {
    var input = document.createElement("input");
    input.setAttribute("type", type);
    return input.type === type;
  };

  var formatGermanDate = function (date) {
    var day = date.getDate();
    var month = date.getMonth() + 1;
    var year = date.getFullYear();
    if (day < 10) {
      day = "0" + day;
    }
    if (month < 10) {
      month = "0" + month;
    }
    return day + "." + month + "." + year;
  };

  var formatDate = function (date) {
    var day = date.getDate();
    var month = date.getMonth() + 1;
    var year = date.getFullYear();
    if (day < 10) {
      day = "0" + day;
    }
    if (month < 10) {
      month = "0" + month;
    }
    return year + "-" + month + "-" + day;
  };

  return app;
})();
