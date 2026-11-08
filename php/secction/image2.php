<style>
        .smoky-content {
            background-color: #00031f;
            padding: 20px;
        }

        .carousel-item {
            display: flex;
            justify-content: center;
        }

        .carousel-item img {
            width: 25%; /* Ajusta el tamaño según sea necesario */
            height: auto;
            margin: 0 10px;
        }

        @media (max-width: 767px) {
            .carousel-item img {
                width: 100%; /* Ajusta el tamaño para dispositivos móviles */
                margin: 10px 0;
            }
        }
        
        .carousel-title {
            text-align: center;
            color: white !important;
            margin-bottom: 20px;
        }
        
        
    </style>
    
    
    
    
    <div class="smoky-content">
        
          <h2 class="carousel-title">Progreso del Torneo</h2> <!-- Título del carrusel -->
          
            
        <div id="multiItemCarousel" class="carousel slide" data-bs-ride="carousel">
            <div class="carousel-inner">
                <!--div class="carousel-item active">
                    <!--img src="images/Copa 1.webp" class="d-block" alt="Image 1">
                    <img src="images/Copa 4.webp" class="d-block" alt="Image 2">
                    <img src="images/Copa 2.webp" class="d-block" alt="Image 3">
                </div-->
                <div class="carousel-item">
                    <img src="images/Copa 1.webp" class="d-block" alt="Image 4">
                    <img src="images/Copa 2.webp" class="d-block" alt="Image 5">
                    <img src="images/Copa 5.webp" class="d-block" alt="Image 6">
                     <img src="images/Copa 4.webp" class="d-block" alt="Image 7">
                </div>
                <!-- Agrega más elementos de carrusel aquí si es necesario -->
            </div>
            <!--button class="carousel-control-prev" type="button" data-bs-target="#multiItemCarousel" data-bs-slide="prev">
                <!--span class="carousel-control-prev-icon" aria-hidden="true"></span>
                <span class="visually-hidden">Previous</span>
            </button>
            <button class="carousel-control-next" type="button" data-bs-target="#multiItemCarousel" data-bs-slide="next">
                <span class="carousel-control-next-icon" aria-hidden="true"></span>
                <span class="visually-hidden">Next</span>
            </button-->
        </div>
    </div>
    <script src="https://stackpath.bootstrapcdn.com/bootstrap/5.1.3/js/bootstrap.bundle.min.js"></script>
