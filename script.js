$(function() {
	//values pulled from query string
	$('#model').val("math-ocr");
	$('#version').val("9");
	$('#api_key').val("DFvQrIh8x90A1oTLSuv0");

	setupButtonListeners();
  retrieveDefaultValuesFromLocalStorage();
});

function infer() {
	$('#output').html("Inferring...");
	$("#resultContainer").show();

	getSettingsFromForm(function(settings) {
		settings.error = function(xhr) {
			$('#output').html("").append([
				"Error loading response.",
				"",
				"Check your API key, model, version,",
				"and other parameters",
				"then try again."
			].join("\n"));
		};

		console.log(settings)

    var image = document.createElement("img");
    image.src = settings.data;
    image.id = "resultimage";

    roboflow.auth({
      publishable_key: $('#api_key').val()
    }).load({
      model: $('#model').val(),
      version: $('#version').val()
    }).then(function(model) {
      console.log("done")
      console.log(model)

      model.configure({
        threshold: 0.5,
        overlap: 0.5,
        max_objects: 20
      });

      model.detect(image).then(function(prediction) {
        console.log(prediction);
        $('#output').html("");
	      $("body").scrollTop(0);
        document.getElementById("output").appendChild(image);
        
        setTimeout(addBoundingBoxes(prediction),2000);
      })
    });
	});
};

function addBoundingBoxes(predictions) {
  var imageBBox = document.getElementById("resultimage").getBoundingClientRect();
  console.log(imageBBox)

  var zindex = 0;
  predictions.sort(function(a,b){
    return (a.bbox.width*a.bbox.height) - (b.bbox.width*b.bbox.height);
  });

  for(i in predictions) {
    var prediction = predictions[i];
    console.log(prediction);

    // PREDICTION BOX
    var predictionBox = document.createElement("div")
    console.log(predictionBox.style)
    var predictionBoxStyle = ""
    predictionBoxStyle += `position: absolute;`;
    predictionBoxStyle += `border: 0.5px black solid;`;//${prediction.color}
    predictionBoxStyle += `top: calc(${prediction.bbox.y + imageBBox.top}px - 0.75rem);`;
    predictionBoxStyle += `left: calc(${prediction.bbox.x + imageBBox.left}px - 0.75rem);`;
    predictionBoxStyle += `width: ${prediction.bbox.width}px;`;
    predictionBoxStyle += `height: ${prediction.bbox.height}px;`;
    predictionBoxStyle += `z-index: ${zindex};`;
    zindex++
    predictionBox.style = predictionBoxStyle;
    document.getElementById("output").appendChild(predictionBox);
  }
  tippy('[data-tippy-content]');
}

function retrieveDefaultValuesFromLocalStorage() {
	try {
		var api_key = localStorage.getItem("rf.api_key");
		var model = localStorage.getItem("rf.model");
		var format = localStorage.getItem("rf.format");

		if (api_key) $('#api_key').val(api_key);
		if (model) $('#model').val(model);
		if (format) $('#format').val(format);
	} catch (e) {
		// localStorage disabled
	}

	$('#model').change(function() {
		localStorage.setItem('rf.model', $(this).val());
	});

	$('#api_key').change(function() {
		localStorage.setItem('rf.api_key', $(this).val());
	});

	$('#format').change(function() {
		localStorage.setItem('rf.format', $(this).val());
	});
};

function setupButtonListeners() {
	// run inference when the form is submitted
	$('#inputForm').submit(function() {
		infer();
		return false;
	});

	// make the buttons blue when clicked
	// and show the proper "Select file" or "Enter url" state
	$('.bttn').click(function() {
		$(this).parent().find('.bttn').removeClass('active');
		$(this).addClass('active');

		if($('#computerButton').hasClass('active')) {
			$('#fileSelectionContainer').show();
			$('#urlContainer').hide();
		} else {
			$('#fileSelectionContainer').hide();
			$('#urlContainer').show();
		}

		if($('#jsonButton').hasClass('active')) {
			$('#imageOptions').hide();
		} else {
			$('#imageOptions').show();
		}

		return false;
	});

	// wire styled button to hidden file input
	$('#fileMock').click(function() {
		$('#file').click();
	});

	// grab the filename when a file is selected
	$("#file").change(function() {
		var path = $(this).val().replace(/\\/g, "/");
		var parts = path.split("/");
		var filename = parts.pop();
		$('#fileName').val(filename);
	});
};

function getSettingsFromForm(cb) {
	var settings = {
		method: "POST",
	};

	var parts = [
		"https://detect.roboflow.com/",
		$('#model').val(),
		"/",
		$('#version').val(),
		"?api_key=" + $('#api_key').val()
	];

	var classes = $('#classes').val();
	if(classes) parts.push("&classes=" + classes);

	var confidence = $('#confidence').val();
	if(confidence) parts.push("&confidence=" + confidence);

	var overlap = $('#overlap').val();
	if(overlap) parts.push("&overlap=" + overlap);

	var format = $('#format .active').attr('data-value');
	parts.push("&format=" + format);
	settings.format = format;

	if(format == "image") {
		var labels = $('#labels .active').attr('data-value');
		if(labels) parts.push("&labels=on");

		var stroke = $('#stroke .active').attr('data-value');
		if(stroke) parts.push("&stroke=" + stroke);

		settings.xhr = function() {
			var override = new XMLHttpRequest();
			override.responseType = 'arraybuffer';
			return override;
		}
	}

	var method = $('#method .active').attr('data-value');
	if(method == "upload") {
		var file = $('#file').get(0).files && $('#file').get(0).files.item(0);
		if(!file) return alert("Please select a file.");

		getBase64fromFile(file).then(function(base64image) {
			settings.url = parts.join("");
			settings.data = base64image;

			console.log(settings);
			cb(settings);
		});
	} else {
		var url = $('#url').val();
		if(!url) return alert("Please enter an image URL");

		parts.push("&image=" + encodeURIComponent(url));

		settings.url = parts.join("");
		console.log(settings);
		cb(settings);
	}
};

function getBase64fromFile(file) {
	return new Promise(function(resolve, reject) {
		var reader = new FileReader();
		reader.readAsDataURL(file);
		reader.onload = function() {
		resizeImage(reader.result).then(function(resizedImage){
			resolve(resizedImage);
		});
    };
		reader.onerror = function(error) {
			reject(error);
		};
	});
};


function resizeImage(base64Str) {

	return new Promise(function(resolve, reject) {
		var img = new Image();
		img.src = base64Str;
		img.onload = function(){
			var canvas = document.createElement("canvas");
			var MAX_WIDTH = 1500;
			var MAX_HEIGHT = 1500;
			var width = img.width;
			var height = img.height;
			if (width > height) {
				if (width > MAX_WIDTH) {
					height *= MAX_WIDTH / width;
					width = MAX_WIDTH;
				}
			} else {
				if (height > MAX_HEIGHT) {
					width *= MAX_HEIGHT / height;
					height = MAX_HEIGHT;
				}
			}
			canvas.width = width;
			canvas.height = height;
			var ctx = canvas.getContext('2d');
			ctx.drawImage(img, 0, 0, width, height);
			resolve(canvas.toDataURL('image/jpeg', 1.0));  
		};
    
	});	
};
