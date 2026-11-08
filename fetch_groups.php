<?php
http_response_code(410);
header("Content-Type: application/json; charset=utf-8");
echo json_encode(["error"=>"Legacy endpoint retired. Use the authenticated administration panel."]);
